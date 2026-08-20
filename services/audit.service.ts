import { Injectable } from '@tsed/di';
import { Prisma } from '../generated/prisma';
import prisma from '@/modules/db';
import { AuditQuerySchema, type AuditQuery } from '@/inputs/audit.input';

@Injectable()
export class AuditService {
  async list(input: AuditQuery) {
    const query = AuditQuerySchema.parse(input);

    const where: Prisma.AuditLogWhereInput = {
      ...(query.entity ? { entity: query.entity } : {}),
      ...(query.action ? { action: query.action } : {}),
      ...(query.actorId ? { actorId: query.actorId } : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.auditLog.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (query.page - 1) * query.limit,
        take: query.limit,
        include: { actor: { select: { id: true, fullName: true, email: true } } },
      }),
      prisma.auditLog.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        page: query.page,
        limit: query.limit,
        total,
        pages: Math.ceil(total / query.limit),
      },
    };
  }

  async facets() {
    const [entities, actions] = await Promise.all([
      prisma.auditLog.findMany({
        distinct: ['entity'],
        select: { entity: true },
        orderBy: { entity: 'asc' },
      }),
      prisma.auditLog.findMany({
        distinct: ['action'],
        select: { action: true },
        orderBy: { action: 'asc' },
      }),
    ]);

    return {
      success: true,
      data: {
        entities: entities.map((row) => row.entity),
        actions: actions.map((row) => row.action),
      },
    };
  }
}
