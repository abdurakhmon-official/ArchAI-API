import { Injectable } from '@tsed/di';
import { notFound } from '@/utils/errors';
import { CONTENT_STATUS } from '../generated/prisma';
import { createHash } from 'node:crypto';
import prisma from '@/modules/db';
import { SkeletonInputSchema, type SkeletonInput } from '@/inputs/catalog.input';
import type { SkeletonRow } from '@/shared/generate';
import { diffOf, recordAudit } from '@/utils/audit';

@Injectable()
export class SkeletonService {
  async list(includeDrafts = false) {
    const items = await prisma.skeleton.findMany({
      where: includeDrafts ? {} : { status: CONTENT_STATUS.PUBLISHED },
      orderBy: [{ floors: 'asc' }, { name: 'asc' }],
    });

    return { success: true, data: items };
  }

  async byId(id: string) {
    const skeleton = await prisma.skeleton.findUnique({ where: { id } });
    if (!skeleton) throw notFound('SKELETON_NOT_FOUND', 'skeleton not found');

    return { success: true, data: skeleton };
  }

  async published(): Promise<SkeletonRow[]> {
    return prisma.skeleton.findMany({
      where: { status: CONTENT_STATUS.PUBLISHED },
      orderBy: [{ floors: 'asc' }, { name: 'asc' }],
      select: {
        id: true,
        name: true,
        floors: true,
        tree: true,
        tagBedrooms: true,
        tagStyles: true,
        minWidth: true,
        maxWidth: true,
        minLength: true,
        maxLength: true,
      },
    });
  }

  async create(input: SkeletonInput, actorId: string | null = null) {
    const data = SkeletonInputSchema.parse(input);
    const skeleton = await prisma.skeleton.create({ data: { ...data, tree: data.tree as object } });

    await recordAudit({ actorId, action: 'create', entity: 'skeleton', entityId: skeleton.id });
    return { success: true, _code: 'SKELETON_CREATED', _message: 'skeleton created', data: skeleton };
  }

  async update(id: string, input: SkeletonInput, actorId: string | null = null) {
    const data = SkeletonInputSchema.parse(input);

    const existing = await prisma.skeleton.findUnique({ where: { id } });
    if (!existing) throw notFound('SKELETON_NOT_FOUND', 'skeleton not found');

    const skeleton = await prisma.skeleton.update({
      where: { id },
      data: { ...data, tree: data.tree as object },
    });

    await recordAudit({
      actorId,
      action: 'update',
      entity: 'skeleton',
      entityId: id,
      diff: diffOf(
        { ...existing, tree: this.hashTree(existing.tree) },
        { ...skeleton, tree: this.hashTree(skeleton.tree) },
      ),
    });

    return { success: true, _code: 'SKELETON_UPDATED', _message: 'skeleton updated', data: skeleton };
  }

  async duplicate(id: string, actorId: string | null = null) {
    const existing = await prisma.skeleton.findUnique({ where: { id } });
    if (!existing) throw notFound('SKELETON_NOT_FOUND', 'skeleton not found');

    const { id: _ignored, createdAt, updatedAt, ...rest } = existing;

    const copy = await prisma.skeleton.create({
      data: {
        ...rest,
        tree: rest.tree as object,
        name: `${existing.name} (copy)`,
        status: CONTENT_STATUS.DRAFT,
      },
    });

    await recordAudit({
      actorId,
      action: 'create',
      entity: 'skeleton',
      entityId: copy.id,
      diff: { duplicatedFrom: id },
    });

    return { success: true, _code: 'SKELETON_DUPLICATED', _message: 'skeleton duplicated', data: copy };
  }

  async delete(id: string, actorId: string | null = null) {
    const existing = await prisma.skeleton.findUnique({ where: { id } });
    if (!existing) throw notFound('SKELETON_NOT_FOUND', 'skeleton not found');

    const used = await prisma.project.count({ where: { skeletonId: id, deletedAt: null } });

    if (used > 0) {
      const archived = await prisma.skeleton.update({
        where: { id },
        data: { status: CONTENT_STATUS.ARCHIVED },
      });

      await recordAudit({
        actorId,
        action: 'archive',
        entity: 'skeleton',
        entityId: id,
        diff: { usedByProjects: used },
      });

      return {
        success: true,
        _code: 'SKELETON_ARCHIVED', _message: `skeleton archived, still used by ${used} projects`,
        meta: { count: used },
        data: archived,
      };
    }

    await prisma.skeleton.delete({ where: { id } });
    await recordAudit({ actorId, action: 'delete', entity: 'skeleton', entityId: id });

    return { success: true, _code: 'SKELETON_REMOVED', _message: 'skeleton removed' };
  }

  private hashTree(tree: unknown): string {
    return createHash('sha1').update(JSON.stringify(tree)).digest('hex').slice(0, 12);
  }
}
