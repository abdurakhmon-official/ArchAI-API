import { z } from 'zod';
import { EstimateSelectionSchema } from '@/inputs/estimate.input';
import { GenerateInputSchema } from '@/inputs/generation.input';
import { GeometryStateSchema } from '@/inputs/geometry.input';

export const CreateProjectInputSchema = z.object({
  title: z.string().min(1).max(120),
  note: z.string().max(1000).optional().nullable(),
  styleSlug: z.string().optional().nullable(),
  skeletonId: z.string().optional().nullable(),
  params: GenerateInputSchema,
  geometry: GeometryStateSchema,
  finishLevel: z.string().default('standard'),
  selection: EstimateSelectionSchema.optional(),
});

export const UpdateProjectInputSchema = z.object({
  title: z.string().min(1).max(120).optional(),
  note: z.string().max(1000).optional().nullable(),
  geometry: GeometryStateSchema.optional(),
  finishLevel: z.string().optional(),
  selection: EstimateSelectionSchema.optional(),
  versionLabel: z.string().max(80).optional(),
});

export const UpdateSelectionInputSchema = z.object({
  selection: EstimateSelectionSchema.default({}),
});

export const ListProjectsInputSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(50).default(12),
  search: z.string().max(120).optional(),
  sortBy: z.enum(['updatedAt', 'createdAt', 'title']).default('updatedAt'),
  order: z.enum(['asc', 'desc']).default('desc'),
});

/**
 * Admin ro'yxati.
 *
 * `ListProjectsInputSchema` dan farqi ikkita: qidiruv sarlavha bilan
 * birga EGASI bo'yicha ham ketadi (admin ko'pincha "falonchining
 * loyihalari" deb qidiradi) va o'chirilganlarni ham ko'rish mumkin —
 * ular 30 kun saqlanadi va admin ularni ko'rmasa, "loyiham yo'qoldi"
 * degan murojaatga javob berolmaydi.
 */
export const ListAllProjectsInputSchema = ListProjectsInputSchema.extend({
  deleted: z.enum(['exclude', 'include', 'only']).default('exclude'),
});

export type ListAllProjectsInput = z.infer<typeof ListAllProjectsInputSchema>;
export type CreateProjectInput = z.infer<typeof CreateProjectInputSchema>;
export type UpdateProjectInput = z.infer<typeof UpdateProjectInputSchema>;
export type UpdateSelectionInput = z.infer<typeof UpdateSelectionInputSchema>;
export type ListProjectsInput = z.infer<typeof ListProjectsInputSchema>;
