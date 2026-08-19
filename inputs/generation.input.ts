import { z } from 'zod';

export const ExtraSchema = z.enum(['balcony', 'terrace', 'basement', 'sauna', 'pool']);

export const RoomCountsSchema = z
  .record(
    z.string().min(2).max(40).regex(/^[a-z0-9_]+$/),
    z.number().int().min(0).max(20),
  )
  .refine((rooms) => Object.keys(rooms).length <= 40, {
    message: 'xona turlari soni juda ko\'p',
  });

export const GenerateInputSchema = z.object({
  landAreaSotix: z.number().min(1).max(200),
  width: z.number().min(4).max(40),
  length: z.number().min(4).max(40),
  floors: z.number().int().min(1).max(3).default(1),
  rooms: RoomCountsSchema.default({}),
  kitchen: z.enum(['separate', 'combined']).default('separate'),
  garage: z.number().int().min(0).max(3).default(0),
  extras: z.array(ExtraSchema).default([]),
  styleSlug: z.string().optional(),
  /**
   * Chizmaning qaysi cheti shimolga qaraydi.
   *
   * Ixtiyoriy: berilmasa yo'nalish hisobga olinmaydi va eski
   * havolalar o'zgarishsiz ishlayveradi.
   */
  northSide: z.enum(['north', 'east', 'south', 'west']).optional(),
  variants: z.number().int().min(1).max(6).default(4),
  seed: z.number().int().optional(),
  finishLevel: z.string().default('standard'),
});

export const MAX_FOOTPRINT_SHARE = 0.6;

export const GenerateInputRefined = GenerateInputSchema.refine(
  (input) => input.width * input.length <= input.landAreaSotix * 100 * MAX_FOOTPRINT_SHARE,
  {
    message: 'VALIDATION_FOOTPRINT',
    path: ['width'],
  },
);

export type GenerateInput = z.infer<typeof GenerateInputSchema>;
export type RoomCounts = z.infer<typeof RoomCountsSchema>;
export type Extra = z.infer<typeof ExtraSchema>;
