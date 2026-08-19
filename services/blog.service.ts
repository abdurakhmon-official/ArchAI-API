import { Injectable } from '@tsed/di';
import { badRequest, notFound } from '@/utils/errors';
import { CONTENT_STATUS, Prisma } from '../generated/prisma';
import prisma from '@/modules/db';
import {
  BlogCategoryInputSchema,
  BlogPostInputSchema,
  ListPostsInputSchema,
  type BlogCategoryInput,
  type BlogPostInput,
  type ListPostsInput,
} from '@/inputs/content.input';

const LIST_SELECT = {
  id: true,
  slug: true,
  title: true,
  excerpt: true,
  cover_url: true,
  status: true,
  views: true,
  published_at: true,
  created_at: true,
  category: { select: { slug: true, name: true } },
  author: { select: { fullName: true } },
};

@Injectable()
export class BlogService {
  async list(input: ListPostsInput, includeDrafts = false) {
    const query = ListPostsInputSchema.parse(input);

    const where: Prisma.BlogPostWhereInput = {
      ...(includeDrafts
        ? query.status
          ? { status: query.status }
          : {}
        : { status: CONTENT_STATUS.PUBLISHED, published_at: { lte: new Date() } }),
      ...(query.category ? { category: { slug: query.category } } : {}),
      ...(query.search
        ? {
            OR: [
              { slug: { contains: query.search, mode: Prisma.QueryMode.insensitive } },
              { title: { string_contains: query.search } },
            ],
          }
        : {}),
    };

    const [items, total] = await prisma.$transaction([
      prisma.blogPost.findMany({
        where,
        select: LIST_SELECT,
        orderBy: [{ published_at: 'desc' }, { created_at: 'desc' }],
        skip: (query.page - 1) * query.limit,
        take: query.limit,
      }),
      prisma.blogPost.count({ where }),
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

  async bySlug(slug: string, includeDrafts = false) {
    const post = await prisma.blogPost.findUnique({
      where: { slug },
      include: {
        category: { select: { slug: true, name: true } },
        author: { select: { fullName: true, avatar: true } },
      },
    });

    if (!post) throw notFound('POST_NOT_FOUND', 'post not found');

    const visible =
      post.status === CONTENT_STATUS.PUBLISHED &&
      (!post.published_at || post.published_at <= new Date());

    if (!visible && !includeDrafts) throw notFound('POST_NOT_FOUND', 'post not found');

    if (visible) {
      await prisma.blogPost.update({
        where: { id: post.id },
        data: { views: { increment: 1 } },
      });
    }

    return { success: true, data: post };
  }

  async create(input: BlogPostInput, authorId?: string) {
    const data = BlogPostInputSchema.parse(input);

    const existing = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
    if (existing) throw badRequest('SLUG_TAKEN', 'this slug is already taken');

    const post = await prisma.blogPost.create({
      data: {
        ...data,
        body: data.body as Prisma.InputJsonValue,
        author_id: authorId ?? null,
        published_at:
          data.published_at ??
          (data.status === CONTENT_STATUS.PUBLISHED ? new Date() : null),
      },
    });

    return { success: true, _code: 'POST_CREATED', _message: 'post created', data: post };
  }

  async update(id: string, input: BlogPostInput) {
    const data = BlogPostInputSchema.parse(input);

    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw notFound('POST_NOT_FOUND', 'post not found');

    const clash = await prisma.blogPost.findUnique({ where: { slug: data.slug } });
    if (clash && clash.id !== id) throw badRequest('SLUG_TAKEN', 'this slug is already taken');

    const post = await prisma.blogPost.update({
      where: { id },
      data: {
        ...data,
        body: data.body as Prisma.InputJsonValue,
        published_at:
          data.published_at ??
          (data.status === CONTENT_STATUS.PUBLISHED
            ? (existing.published_at ?? new Date())
            : null),
      },
    });

    return { success: true, _code: 'POST_UPDATED', _message: 'post updated', data: post };
  }

  async remove(id: string) {
    const existing = await prisma.blogPost.findUnique({ where: { id } });
    if (!existing) throw notFound('POST_NOT_FOUND', 'post not found');

    await prisma.blogPost.delete({ where: { id } });
    return { success: true, _code: 'POST_REMOVED', _message: 'post removed' };
  }

  async categories() {
    const items = await prisma.blogCategory.findMany({
      orderBy: { sort: 'asc' },
      include: { _count: { select: { posts: true } } },
    });

    return { success: true, data: items };
  }

  async createCategory(input: BlogCategoryInput) {
    const data = BlogCategoryInputSchema.parse(input);

    const existing = await prisma.blogCategory.findUnique({ where: { slug: data.slug } });
    if (existing) throw badRequest('SLUG_TAKEN', 'this slug is already taken');

    const category = await prisma.blogCategory.create({ data });
    return { success: true, _code: 'CATEGORY_CREATED', _message: 'category created', data: category };
  }

  async removeCategory(id: string) {
    const posts = await prisma.blogPost.count({ where: { category_id: id } });

    if (posts > 0) {
      throw badRequest('CATEGORY_HAS_POSTS', `this category still holds ${posts} posts`, { count: posts });
    }

    await prisma.blogCategory.delete({ where: { id } });
    return { success: true, _code: 'CATEGORY_REMOVED', _message: 'category removed' };
  }
}
