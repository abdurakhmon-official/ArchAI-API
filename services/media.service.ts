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
        original_name: input.originalName,
        mime_type: input.mimeType,
        size: input.size,
        uploaded_by: this.user?.id ?? null,
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
        ? { original_name: { contains: query.search, mode: Prisma.QueryMode.insensitive } }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.media.findMany({
        where,
        // Yuklagan odam ham keladi: admin ekranida "buni kim qo'ygan"
        // degan savol birinchi bo'lib tug'iladi, va uni javobsiz
        // qoldirish faylni o'chirishga qo'rqinchli qiladi.
        include: { uploader: { select: { fullName: true, email: true } } },
        orderBy: { created_at: 'desc' },
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
    const isOwner = media.uploaded_by && media.uploaded_by === user?.id;
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
      where: { created_at: { lt: deadline } },
      select: { id: true, url: true, key: true, size: true, original_name: true },
    });

    if (candidates.length === 0) return { success: true, data: [] };

    const urls = candidates.map((item) => item.url);

    const [furniture, styles, posts, avatars] = await Promise.all([
      prisma.furnitureAsset.findMany({
        where: { OR: [{ gltf_url: { in: urls } }, { thumb_url: { in: urls } }] },
        select: { gltf_url: true, thumb_url: true },
      }),
      prisma.style.findMany({ where: { preview_url: { in: urls } }, select: { preview_url: true } }),
      prisma.blogPost.findMany({ where: { cover_url: { in: urls } }, select: { cover_url: true } }),
      prisma.user.findMany({ where: { avatar: { in: urls } }, select: { avatar: true } }),
    ]);

    const used = new Set<string>(
      [
        ...furniture.flatMap((row) => [row.gltf_url, row.thumb_url]),
        ...styles.map((row) => row.preview_url),
        ...posts.map((row) => row.cover_url),
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
