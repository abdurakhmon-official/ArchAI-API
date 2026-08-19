import { Injectable } from '@tsed/di';
import { badRequest, notFound } from '@/utils/errors';
import { CONTENT_STATUS } from '../generated/prisma';
import prisma from '@/modules/db';
import { RoofStyleInputSchema, type RoofStyleInput } from '@/inputs/catalog.input';
import { diffOf, recordAudit } from '@/utils/audit';

function assertMansard(family: string, pitch: number, upperPitch?: number | null) {
  if (family !== 'mansard') return;
  if (upperPitch === null || upperPitch === undefined) return;

  if (upperPitch >= pitch) {
    throw badRequest('ROOF_MANSARD_PITCH', 'the upper mansard pitch must be shallower than the lower one');
  }
}

@Injectable()
export class RoofStyleService {
  async listPublished() {
    const items = await prisma.roofStyle.findMany({
      where: { status: CONTENT_STATUS.PUBLISHED },
      orderBy: [{ sort: 'asc' }, { code: 'asc' }],
      include: { covering: { select: { code: true, name: true, unit_price: true } } },
    });

    return { success: true, data: items };
  }

  async listAll() {
    const items = await prisma.roofStyle.findMany({
      orderBy: [{ sort: 'asc' }, { code: 'asc' }],
      include: {
        covering: { select: { code: true, name: true, unit_price: true } },
        _count: { select: { styles: true } },
      },
    });

    return { success: true, data: items };
  }

  async create(input: RoofStyleInput, actorId: string | null = null) {
    const data = RoofStyleInputSchema.parse(input);

    const clash = await prisma.roofStyle.findUnique({ where: { code: data.code } });
    if (clash) throw badRequest('CODE_TAKEN', 'this code is already taken');

    await this.assertCovering(data.covering_id);
    assertMansard(data.family, data.pitch, data.upper_pitch);

    const item = await prisma.roofStyle.create({ data });
    await recordAudit({ actorId, action: 'create', entity: 'roof_style', entityId: item.id });

    return { success: true, _code: 'ROOF_STYLE_CREATED', _message: 'roof style created', data: item };
  }

  async update(id: string, input: Partial<RoofStyleInput>, actorId: string | null = null) {
    const data = RoofStyleInputSchema.partial().parse(input);

    const existing = await prisma.roofStyle.findUnique({ where: { id } });
    if (!existing) throw notFound('ROOF_STYLE_NOT_FOUND', 'roof style not found');

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.roofStyle.findUnique({ where: { code: data.code } });
      if (clash && clash.id !== id) throw badRequest('CODE_TAKEN', 'this code is already taken');
    }

    if (data.covering_id) await this.assertCovering(data.covering_id);

    assertMansard(
      data.family ?? existing.family,
      data.pitch ?? existing.pitch,
      data.upper_pitch ?? existing.upper_pitch,
    );

    const item = await prisma.roofStyle.update({ where: { id }, data });
    await recordAudit({
      actorId,
      action: 'update',
      entity: 'roof_style',
      entityId: id,
      diff: diffOf(existing, item),
    });

    return { success: true, _code: 'ROOF_STYLE_UPDATED', _message: 'roof style updated', data: item };
  }

  async delete(id: string, actorId: string | null = null) {
    const existing = await prisma.roofStyle.findUnique({ where: { id } });
    if (!existing) throw notFound('ROOF_STYLE_NOT_FOUND', 'roof style not found');

    const used = await prisma.style.count({ where: { roof_style_id: id } });

    if (used > 0) {
      const archived = await prisma.roofStyle.update({
        where: { id },
        data: { status: CONTENT_STATUS.ARCHIVED },
      });
      await recordAudit({
        actorId,
        action: 'archive',
        entity: 'roof_style',
        entityId: id,
        diff: { usedByStyles: used },
      });

      return {
        success: true,
        _code: 'ROOF_STYLE_ARCHIVED', _message: `roof style archived, still used by ${used} styles`,
        meta: { count: used },
        data: archived,
      };
    }

    await prisma.roofStyle.delete({ where: { id } });
    await recordAudit({ actorId, action: 'delete', entity: 'roof_style', entityId: id });

    return { success: true, _code: 'ROOF_STYLE_REMOVED', _message: 'roof style removed' };
  }

  private async assertCovering(id?: string | null) {
    if (!id) return;

    const option = await prisma.priceOption.findUnique({
      where: { id },
      include: { item: { select: { category: true } } },
    });

    if (!option) throw badRequest('ROOF_COVER_NOT_FOUND', 'cover material not found');
    if (option.item.category !== 'ROOF') {
      throw badRequest('ROOF_COVER_CATEGORY', 'the cover must be a material in the roof category');
    }
  }
}
