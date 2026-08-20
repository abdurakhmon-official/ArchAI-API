import { Injectable } from '@tsed/di';
import { notFound } from '@/utils/errors';
import { EXPORT_KIND, Prisma } from '../generated/prisma';
import prisma from '@/modules/db';
import { deleteObject } from '@/modules/storage';

@Injectable()
export class ExportAdminService {
  async list(query: { page?: number; limit?: number; kind?: EXPORT_KIND; search?: string } = {}) {
    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 24));

    const where: Prisma.ProjectExportWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.search
        ? { project: { title: { contains: query.search, mode: Prisma.QueryMode.insensitive } } }
        : {}),
    };

    const [items, total, stats] = await prisma.$transaction([
      prisma.projectExport.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          project: { select: { id: true, title: true, user: { select: { email: true } } } },
        },
      }),
      prisma.projectExport.count({ where }),
      // Jami hajm — admin uchun eng muhim son: saqlash joyi shundan to'ladi.
      prisma.projectExport.aggregate({ _sum: { sizeBytes: true } }),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        bytes: stats._sum.sizeBytes ?? 0,
      },
    };
  }

  async remove(id: string) {
    const item = await prisma.projectExport.findUnique({ where: { id } });
    if (!item) throw notFound('EXPORT_NOT_FOUND', 'export not found');

    try {
      await deleteObject(item.storageKey);
    } catch (error) {
      console.warn(`export o'chmadi: ${item.storageKey} —`, (error as Error).message);
    }

    await prisma.projectExport.delete({ where: { id } });

    return { success: true, _code: 'EXPORT_REMOVED', _message: 'export removed' };
  }

  async purgeExpired() {
    const expired = await prisma.projectExport.findMany({
      where: { expiresAt: { lt: new Date() } },
      select: { id: true, storageKey: true },
    });

    for (const item of expired) {
      try {
        await deleteObject(item.storageKey);
      } catch {
      }
    }

    await prisma.projectExport.deleteMany({
      where: { id: { in: expired.map((item) => item.id) } },
    });

    return {
      success: true,
      _code: 'EXPORTS_PURGED',
      _message: `${expired.length} expired exports removed`,
      meta: { count: expired.length },
      data: { removed: expired.length },
    };
  }
}
