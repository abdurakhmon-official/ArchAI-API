import { PlatformContext } from '@tsed/common';
import { Injectable, InjectContext } from '@tsed/di';
import { notFound, forbidden } from '@/utils/errors';
import type { Request } from 'express';
import { MEDIA_TYPE, Prisma, USER_ROLE } from '../generated/prisma';
import prisma from '@/modules/db';
import { deleteObjects } from '@/modules/storage';
import { RegisterMediaInput } from '@/inputs';

@Injectable()
export class MediaService {
  @InjectContext()
  private context!: PlatformContext;

  private get user() {
    return this.context?.getRequest<Request>()?.user;
  }

  async register(input: RegisterMediaInput) {
    const media = await prisma.media.create({
      data: {
        type: input.type,
        url: input.url,
        key: input.key,
        originalName: input.originalName,
        mimeType: input.mimeType,
        size: input.size,
        uploadedBy: this.user?.id ?? null,
      },
    });

    return { success: true, data: media };
  }

  async list(query: { page?: number; limit?: number; type?: MEDIA_TYPE; search?: string } = {}) {
    const page = Math.max(1, query.page ?? 1);
    const limit = Math.min(100, Math.max(1, query.limit ?? 24));

    const where: Prisma.MediaWhereInput = {
      ...(query.type ? { type: query.type } : {}),
      ...(query.search
        ? { originalName: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.media.findMany({
        where,
        // Yuklagan odam ham keladi: admin ekranida "buni kim qo'ygan"
        // degan savol birinchi bo'lib tug'iladi, va uni javobsiz
        // qoldirish faylni o'chirishga qo'rqinchli qiladi.
        include: { uploader: { select: { fullName: true, email: true } } },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.media.count({ where }),
    ]);

    return {
      success: true,
      data: items,
      meta: { page, limit, total, pages: Math.ceil(total / limit) },
    };
  }

  async byId(id: string) {
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) throw notFound('MEDIA_NOT_FOUND', 'media not found');

    return { success: true, data: media };
  }

  async remove(id: string) {
    const media = await prisma.media.findUnique({ where: { id } });
    if (!media) throw notFound('MEDIA_NOT_FOUND', 'media not found');

    const user = this.user;
    const isOwner = media.uploadedBy && media.uploadedBy === user?.id;
    const isAdmin = user?.role === USER_ROLE.ADMIN;

    if (!isOwner && !isAdmin) {
      throw forbidden('MEDIA_NOT_OWNER', 'you can only delete your own uploads');
    }

    await deleteObjects([media.key]);
    await prisma.media.delete({ where: { id } });

    return { success: true, _code: 'FILE_REMOVED', _message: 'file removed' };
  }

  async findOrphans(olderThanDays = 7) {
    const deadline = new Date();
    deadline.setDate(deadline.getDate() - olderThanDays);

    const candidates = await prisma.media.findMany({
      where: { createdAt: { lt: deadline } },
      select: { id: true, url: true, key: true, size: true, originalName: true },
    });

    if (candidates.length === 0) return { success: true, data: [] };

    const urls = candidates.map((item) => item.url);

    const [furniture, styles, posts, avatars] = await Promise.all([
      prisma.furnitureAsset.findMany({
        where: { OR: [{ gltfUrl: { in: urls } }, { thumbUrl: { in: urls } }] },
        select: { gltfUrl: true, thumbUrl: true },
      }),
      prisma.style.findMany({ where: { previewUrl: { in: urls } }, select: { previewUrl: true } }),
      prisma.blogPost.findMany({ where: { coverUrl: { in: urls } }, select: { coverUrl: true } }),
      prisma.user.findMany({ where: { avatar: { in: urls } }, select: { avatar: true } }),
    ]);

    const used = new Set<string>(
      [
        ...furniture.flatMap((row) => [row.gltfUrl, row.thumbUrl]),
        ...styles.map((row) => row.previewUrl),
        ...posts.map((row) => row.coverUrl),
        ...avatars.map((row) => row.avatar),
      ].filter((value): value is string => Boolean(value)),
    );

    const orphans = candidates.filter((item) => !used.has(item.url));

    return {
      success: true,
      data: orphans,
      meta: {
        count: orphans.length,
        bytes: orphans.reduce((sum, item) => sum + item.size, 0),
      },
    };
  }

  async purgeOrphans(olderThanDays = 7) {
    const { data } = await this.findOrphans(olderThanDays);
    const orphans = data as Array<{ id: string; key: string }>;

    if (orphans.length === 0) {
      return { success: true, _code: 'ORPHANS_NONE', _message: 'no orphan files to remove', data: { removed: 0 } };
    }

    await deleteObjects(orphans.map((item) => item.key));
    await prisma.media.deleteMany({ where: { id: { in: orphans.map((item) => item.id) } } });

    return {
      success: true,
      _code: 'ORPHANS_PURGED', _message: `${orphans.length} files removed`,
      meta: { count: orphans.length },
      data: { removed: orphans.length },
    };
  }
}
