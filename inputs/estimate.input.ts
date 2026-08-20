import { z } from 'zod';
import { PRICE_CATEGORY } from '../generated/prisma';
import { MEASURE_KEYS } from '@/geometry/measure';
import { GeometryStateSchema } from '@/inputs/geometry.input';
import { TranslatedSchema } from '@/inputs/catalog.input';

export const LineSelectionSchema = z.object({
  optionCode: z.string().max(40).optional(),
  unitPrice: z.number().min(0).max(1_000_000_000).optional(),
  excluded: z.boolean().optional(),
  note: z.string().max(300).optional(),
});

export const EstimateSelectionSchema = z.record(z.string().max(40), LineSelectionSchema);

export const EstimateInputSchema = z.object({
  geometry: GeometryStateSchema,
  finishLevel: z.string().default('standard'),
  selection: EstimateSelectionSchema.default({}),
  roofType: z.enum(['flat', 'shed', 'gable', 'hip']).default('gable'),
  roofPitch: z.number().min(0).max(60).default(25),
  ceilingHeight: z.number().min(2.2).max(4.5).default(2.8),
});

export const PriceItemInputSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/),
  category: z.nativeEnum(PRICE_CATEGORY),
  name: TranslatedSchema,
  unit: z.string().min(1).max(12),
  unitPrice: z.number().min(0).max(1_000_000_000),
  measure: z.enum(MEASURE_KEYS),
  sort: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});

export const PriceOptionInputSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[a-z0-9_]+$/),
  name: TranslatedSchema,
  description: TranslatedSchema.optional().nullable(),
  unitPrice: z.number().min(0).max(1_000_000_000),
  imageUrl: z.string().url().max(500).optional().nullable(),
  sort: z.number().int().min(0).max(999).default(0),
  active: z.boolean().default(true),
});

export const FinishLevelInputSchema = z.object({
  name: TranslatedSchema.optional(),
  defaults: z.record(z.string().max(40), z.string().max(40)),
  sort: z.number().int().min(0).max(999).optional(),
});

export type EstimateInput = z.infer<typeof EstimateInputSchema>;
export type LineSelection = z.infer<typeof LineSelectionSchema>;
export type PriceItemInput = z.infer<typeof PriceItemInputSchema>;
export type PriceOptionInput = z.infer<typeof PriceOptionInputSchema>;
export type FinishLevelInput = z.infer<typeof FinishLevelInputSchema>;
