import { z } from 'zod';
import { CONTENT_STATUS, LEAD_STATUS } from '../generated/prisma';
import { TranslatedSchema } from '@/inputs/catalog.input';

const SLUG = z
  .string()
  .min(2)
  .max(120)
  .regex(/^[a-z0-9-]+$/, 'VALIDATION_SLUG');

export const BlogCategoryInputSchema = z.object({
  slug: SLUG,
  name: TranslatedSchema,
  sort: z.number().int().default(0),
});

export const BlogPostInputSchema = z.object({
  slug: SLUG,
  title: TranslatedSchema,
  excerpt: TranslatedSchema.optional(),
  body: z.record(z.unknown()),
  coverUrl: z.string().url().optional().nullable(),
  categoryId: z.string().optional().nullable(),
  status: z.nativeEnum(CONTENT_STATUS).default(CONTENT_STATUS.DRAFT),
  publishedAt: z.coerce.date().optional().nullable(),
});

export const ListPostsInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  category: z.string().optional(),
  search: z.string().max(120).optional(),
  status: z.nativeEnum(CONTENT_STATUS).optional(),
});

export const FaqInputSchema = z.object({
  category: z.string().min(2).max(40).default('general'),
  question: TranslatedSchema,
  answer: TranslatedSchema,
  sort: z.number().int().default(0),
  active: z.boolean().default(true),
});

export const FaqReorderSchema = z.object({
  items: z
    .array(z.object({ id: z.string().min(1).max(40), sort: z.number().int().min(0).max(999) }))
    .min(1)
    .max(200),
});

export const LeadInputSchema = z.object({
  name: z.string().min(2).max(120),
  phone: z
    .string()
    .min(7)
    .max(20)
    .regex(/^[+()\d\s-]+$/, 'VALIDATION_PHONE'),
  message: z.string().max(2000).optional(),
  source: z.string().max(40).default('contact'),
  payload: z.record(z.unknown()).optional(),
});

export const UpdateLeadInputSchema = z
  .object({
    status: z.nativeEnum(LEAD_STATUS).optional(),
    adminNote: z.string().max(2000).nullable().optional(),
  })
  .refine((value) => value.status !== undefined || value.adminNote !== undefined, {
    message: 'VALIDATION_STATUS_OR_NOTE',
  });

export type BlogCategoryInput = z.infer<typeof BlogCategoryInputSchema>;
export type BlogPostInput = z.infer<typeof BlogPostInputSchema>;
export type ListPostsInput = z.infer<typeof ListPostsInputSchema>;
export type FaqInput = z.infer<typeof FaqInputSchema>;
export type FaqReorder = z.infer<typeof FaqReorderSchema>;
export type LeadInput = z.infer<typeof LeadInputSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadInputSchema>;
