import { z } from 'zod';

export const SortingSchema = z.object({
  key: z.string(),
  order: z.enum(['asc', 'desc']).default('desc'),
});

export const BasicSearchSchema = z
  .object({
    size: z.coerce.number().nullable().default(10),
    page: z.coerce.number().nullable().default(1),
    search: z.string().optional().nullable(),
    sortBy: z.array(SortingSchema).default([
      {
        key: 'createdAt',
        order: 'desc',
      },
    ]),
  })
  .transform(({ search, size, page, sortBy }) => {
    size = size || 10;
    page = page || 1;

    const sorting: Record<string, string> = {};
    sortBy.forEach(({ key, order }) => (sorting[key] = order));

    return { search, size: size, page: page, skip: (page - 1) * size, sorting };
  });

BasicSearchSchema.refine(data => {
  return true;
});

export type BasicSearch = z.infer<typeof BasicSearchSchema>;
