import { Injectable } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import { badRequest, notFound } from '@/utils/errors';
import prisma from '@/modules/db';
import {
  RoomTypeFieldsSchema,
  RoomTypeInputSchema,
  type RoomTypeInput,
} from '@/inputs/catalog.input';
import { leaves } from '@/geometry/tree';
import type { RoomTypeRule, TreeNode } from '@/geometry/types';
import { diffOf, recordAudit } from '@/utils/audit';
import { toRule } from '@/utils/room-rule';

@Injectable()
export class RoomTypeService {
  async list() {
    const items = await prisma.roomType.findMany({ orderBy: { sort: 'asc' } });
    return { success: true, data: items };
  }

  async selectable() {
    const items = await prisma.roomType.findMany({
      where: { selectable: true },
      orderBy: { sort: 'asc' },
      select: {
        code: true,
        name: true,
        min_area: true,
        max_count: true,
        default_count: true,
        selectable: true,
        sort: true,
      },
    });

    return { success: true, data: items };
  }

  async rules(): Promise<Record<string, RoomTypeRule>> {
    const items = await prisma.roomType.findMany();
    return Object.fromEntries(items.map((item) => [item.code, toRule(item)]));
  }

  async names(locale = 'uz'): Promise<Record<string, string>> {
    const items = await prisma.roomType.findMany();

    return Object.fromEntries(
      items.map((item) => {
        const name = item.name as Record<string, string | undefined>;
        return [item.code, name[locale] || name.uz || item.code];
      }),
    );
  }

  async create(input: RoomTypeInput, actorId: string | null = null) {
    const data = RoomTypeInputSchema.parse(input);

    const existing = await prisma.roomType.findUnique({ where: { code: data.code } });
    if (existing) throw badRequest('ROOM_TYPE_CODE_TAKEN', 'this room type code already exists');

    const item = await prisma.roomType.create({ data });
    await recordAudit({ actorId, action: 'create', entity: 'room_type', entityId: item.id });

    return { success: true, _code: 'ROOM_TYPE_CREATED', _message: 'room type created', data: item };
  }

  async update(id: string, input: Partial<RoomTypeInput>, actorId: string | null = null) {
    const data = RoomTypeFieldsSchema.partial().parse(input);

    const existing = await prisma.roomType.findUnique({ where: { id } });
    if (!existing) throw notFound('ROOM_TYPE_NOT_FOUND', 'room type not found');

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.roomType.findUnique({ where: { code: data.code } });
      if (clash && clash.id !== id) throw badRequest('ROOM_TYPE_CODE_TAKEN', 'this room type code already exists');
    }

    const minArea = data.min_area ?? existing.min_area;
    const maxArea = data.max_area ?? existing.max_area;
    if (maxArea <= minArea) {
      throw badRequest('ROOM_TYPE_AREA_RANGE', 'the maximum area must be larger than the minimum');
    }

    const maxCount = data.max_count ?? existing.max_count;
    const defaultCount = data.default_count ?? existing.default_count;
    if (defaultCount > maxCount) {
      throw badRequest('ROOM_TYPE_DEFAULT_COUNT', 'the default count cannot exceed the maximum');
    }

    const item = await prisma.roomType.update({ where: { id }, data });
    await recordAudit({
      actorId,
      action: 'update',
      entity: 'room_type',
      entityId: id,
      diff: diffOf(existing, item),
    });

    return { success: true, _code: 'ROOM_TYPE_UPDATED', _message: 'room type updated', data: item };
  }

  async delete(id: string, actorId: string | null = null) {
    const existing = await prisma.roomType.findUnique({ where: { id } });
    if (!existing) throw notFound('ROOM_TYPE_NOT_FOUND', 'room type not found');

    const used = await this.usedBySkeletons(existing.code);
    if (used.length > 0) {
      throw badRequest(
        'ROOM_TYPE_IN_USE',
        `this room type is used by ${used.length} skeletons: ${used.slice(0, 3).join(', ')}`,
        { count: used.length, skeletons: used.slice(0, 3).join(', ') },
      );
    }

    await prisma.roomType.delete({ where: { id } });
    await recordAudit({ actorId, action: 'delete', entity: 'room_type', entityId: id });

    return { success: true, _code: 'ROOM_TYPE_REMOVED', _message: 'room type removed' };
  }

  private async usedBySkeletons(code: string): Promise<string[]> {
    const skeletons = await prisma.skeleton.findMany({ select: { name: true, tree: true } });

    return skeletons
      .filter((skeleton) => {
        const floors = (skeleton.tree as { floors?: { tree: TreeNode }[] })?.floors ?? [];
        return floors.some((floor) =>
          floor.tree ? leaves(floor.tree).some((leaf) => leaf.roomType === code) : false,
        );
      })
      .map((skeleton) => skeleton.name);
  }
}
