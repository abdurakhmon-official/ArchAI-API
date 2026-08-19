import { Injectable } from '@tsed/di';
import { notFound } from '@/utils/errors';
import { EXPORT_KIND, Prisma } from '../generated/prisma';
import prisma from '@/modules/db';
import { deleteObject } from '@/modules/storage';

/**
 * Loyiha eksportlari — admin uchun.
 *
 * PDF va 3D rasmlar `media` jadvalida EMAS, `project_exports` da
 * yotadi. Sabab: ular kesh — geometriya o'zgarsa eskisi yaroqsiz
 * bo'ladi va 30 kundan keyin o'zi o'chadi (`purgeExpiredExports`).
 * Yuklangan fayllar esa kontent va ular hech qachon o'z-o'zidan
 * yo'qolmaydi.
 *
 * Shu sababli ular media kutubxonasiga qo'shilmadi: bir ro'yxatga
 * qo'yilsa "yetim fayl" hisobi buzilardi — eksport `ProjectExport`
 * orqali ishlatiladi va `findOrphans` buni ko'rmaydi, ya'ni har bir
 * eksport yetim deb belgilanib, tozalashda o'chib ketardi.
 */

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
        orderBy: { created_at: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: {
          project: { select: { id: true, title: true, user: { select: { email: true } } } },
        },
      }),
      prisma.projectExport.count({ where }),
      // Jami hajm — admin uchun eng muhim son: saqlash joyi shundan to'ladi.
      prisma.projectExport.aggregate({ _sum: { size_bytes: true } }),
    ]);

    return {
      success: true,
      data: items,
      meta: {
        page,
        limit,
        total,
        pages: Math.ceil(total / limit),
        bytes: stats._sum.size_bytes ?? 0,
      },
    };
  }

  async remove(id: string) {
    const item = await prisma.projectExport.findUnique({ where: { id } });
    if (!item) throw notFound('EXPORT_NOT_FOUND', 'export not found');

    /*
      Fayl o'chmasa ham yozuv o'chiriladi.

      Aks holda diskda qolgan bitta fayl butun amalni to'xtatardi va
      admin ro'yxatni tozalay olmasdi. Fayl esa keyingi tunlik
      tozalashda baribir ketadi.
    */
    try {
      await deleteObject(item.storage_key);
    } catch (error) {
      console.warn(`export o'chmadi: ${item.storage_key} —`, (error as Error).message);
    }

    await prisma.projectExport.delete({ where: { id } });

    return { success: true, _code: 'EXPORT_REMOVED', _message: 'export removed' };
  }

  /** Muddati o'tganlarini bir yo'la tozalaydi. */
  async purgeExpired() {
    const expired = await prisma.projectExport.findMany({
      where: { expires_at: { lt: new Date() } },
      select: { id: true, storage_key: true },
    });

    for (const item of expired) {
      try {
        await deleteObject(item.storage_key);
      } catch {
        // Yozuvni baribir o'chiramiz.
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
