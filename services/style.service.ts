import type { StyleConfig } from '@/types/style.types';
import { Injectable } from '@tsed/di';
import { BadRequest, NotFound } from '@tsed/exceptions';
import { CONTENT_STATUS } from '../generated/prisma';
import prisma from '@/modules/db';
import { StyleInputSchema, type StyleInput } from '@/inputs/catalog.input';
import { diffOf, recordAudit } from '@/utils/audit';
import { toConfig } from '@/utils/style-config';

@Injectable()
export class StyleService {
  async listPublished() {
    const items = await prisma.style.findMany({
      where: { status: CONTENT_STATUS.PUBLISHED },
      orderBy: { sort: 'asc' },
      include: { roof_style: true },
    });

    return { success: true, data: items };
  }

  async listAll() {
    const items = await prisma.style.findMany({
      orderBy: [{ sort: 'asc' }, { slug: 'asc' }],
      include: { roof_style: true },
    });
    return { success: true, data: items };
  }

  async bySlug(slug: string) {
    const style = await prisma.style.findUnique({
      where: { slug },
      include: { roof_style: true },
    });
    if (!style || style.status !== CONTENT_STATUS.PUBLISHED) {
      throw new NotFound('style not found');
    }

    return { success: true, data: style };
  }

  async configsFor(slug?: string): Promise<StyleConfig[]> {
    const styles = await prisma.style.findMany({
      where: {
        status: CONTENT_STATUS.PUBLISHED,
        ...(slug ? { slug } : {}),
      },
      orderBy: { sort: 'asc' },
      include: { roof_style: true },
    });

    if (styles.length === 0 && slug) {
      throw new NotFound(`style not found or not published: ${slug}`);
    }

    return styles.map(toConfig);
  }

  async create(input: StyleInput, actorId: string | null = null) {
    const data = StyleInputSchema.parse(input);

    const existing = await prisma.style.findUnique({ where: { slug: data.slug } });
    if (existing) throw new BadRequest('this style slug already exists');

    const style = await prisma.style.create({ data });
    await recordAudit({ actorId, action: 'create', entity: 'style', entityId: style.id });

    return { success: true, _code: 'STYLE_CREATED', _message: 'style created', data: style };
  }

  async update(id: string, input: Partial<StyleInput>, actorId: string | null = null) {
    const data = StyleInputSchema.partial().parse(input);

    const existing = await prisma.style.findUnique({ where: { id } });
    if (!existing) throw new NotFound('style not found');

    if (data.slug && data.slug !== existing.slug) {
      const clash = await prisma.style.findUnique({ where: { slug: data.slug } });
      if (clash && clash.id !== id) throw new BadRequest('this style slug already exists');
    }

    const style = await prisma.style.update({ where: { id }, data });
    await recordAudit({
      actorId,
      action: 'update',
      entity: 'style',
      entityId: id,
      diff: diffOf(existing, style),
    });

    return { success: true, _code: 'STYLE_UPDATED', _message: 'style updated', data: style };
  }

  async delete(id: string, actorId: string | null = null) {
    const existing = await prisma.style.findUnique({ where: { id } });
    if (!existing) throw new NotFound('style not found');

    const used = await prisma.project.count({ where: { style_id: id } });
    if (used > 0) {
      const archived = await prisma.style.update({
        where: { id },
        data: { status: CONTENT_STATUS.ARCHIVED },
      });
      await recordAudit({
        actorId,
        action: 'archive',
        entity: 'style',
        entityId: id,
        diff: { usedByProjects: used },
      });

      return { success: true, _code: 'STYLE_ARCHIVED', _message: 'style archived (used by projects)', data: archived };
    }

    await prisma.style.delete({ where: { id } });
    await recordAudit({ actorId, action: 'delete', entity: 'style', entityId: id });

    return { success: true, _code: 'STYLE_REMOVED', _message: 'style removed' };
  }
}
