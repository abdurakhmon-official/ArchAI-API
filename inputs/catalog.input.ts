import { z } from 'zod';
import { CONTENT_STATUS, ROOF_FAMILY } from '../generated/prisma';
import type { RoofType } from '@/geometry/types';
import { TreeNodeSchema } from '@/inputs/geometry.input';

export const TranslatedSchema = z.object({
  uz: z.string().min(1),
  ru: z.string().optional(),
  en: z.string().optional(),
});

export const ROOF_FAMILIES = [
  'flat',
  'shed',
  'gable',
  'hip',
  'pyramid',
  'mansard',
] as const satisfies readonly RoofType[];

type MissingFromSchema = Exclude<RoofType, (typeof ROOF_FAMILIES)[number]>;
type MissingFromGeometry = Exclude<(typeof ROOF_FAMILIES)[number], RoofType>;
type MissingFromPrisma = Exclude<RoofType, ROOF_FAMILY>;
type ExtraInPrisma = Exclude<ROOF_FAMILY, RoofType>;

const _roofFamiliesMatch: MissingFromSchema | MissingFromGeometry | MissingFromPrisma | ExtraInPrisma extends never
  ? true
  : never = true;
void _roofFamiliesMatch;

export const RoofRulesSchema = z.object({
  type: z.enum(ROOF_FAMILIES),
  pitch: z.number().min(0).max(60),
  overhang: z.number().min(0).max(2),
  material: z.string().min(1),
  color: z.string().min(1),
  upperPitch: z.number().min(0).max(60).optional(),
  breakRatio: z.number().min(0.15).max(0.85).optional(),
});

export const RoofStyleInputSchema = z.object({
  code: z.string().min(2).max(40).regex(/^[a-z0-9_-]+$/),
  name: TranslatedSchema,
  family: z.enum(ROOF_FAMILIES),
  pitch: z.number().min(0).max(60).default(25),
  overhang: z.number().min(0).max(2).default(0.5),
  upper_pitch: z.number().min(0).max(60).optional().nullable(),
  break_ratio: z.number().min(0.15).max(0.85).optional().nullable(),
  covering_id: z.string().max(40).optional().nullable(),
  color: z.string().max(40).optional().nullable(),
  preview_url: z.string().url().max(500).optional().nullable(),
  status: z.nativeEnum(CONTENT_STATUS).default(CONTENT_STATUS.DRAFT),
  sort: z.number().int().min(0).max(999).default(0),
});

export const FacadeRulesSchema = z.object({
  material: z.string().min(1),
  primary: z.string().min(1),
  accent: z.string().min(1),
  plinth: z.string().min(1),
});

export const WindowRulesSchema = z.object({
  ratio: z.number().min(0.3).max(4),
  wallAreaRatio: z.number().min(0.05).max(0.5),
  frameColor: z.string().min(1),
  panoramic: z.boolean().default(false),
});

export const InteriorRulesSchema = z.object({
  ceilingHeight: z.number().min(2.2).max(4.5),
  wallColor: z.string().min(1),
  floorByRoomType: z.record(z.string()).default({}),
  skirting: z.string().optional(),
});

export const LayoutRulesSchema = z.object({
  corridorWidth: z.number().min(1).max(3).default(1.4),
  openKitchen: z.boolean().default(false),
  minAreaFactor: z.number().min(0.7).max(1.5).default(1),
});

export const StyleInputSchema = z.object({
  slug: z.string().min(2).max(40).regex(/^[a-z0-9-]+$/),
  name: TranslatedSchema,
  description: TranslatedSchema.optional(),
  roof: RoofRulesSchema,
  roof_style_id: z.string().max(40).optional().nullable(),
  facade: FacadeRulesSchema,
  window: WindowRulesSchema,
  interior: InteriorRulesSchema,
  layout_rules: LayoutRulesSchema,
  furniture_sets: z.record(z.array(z.string())).optional(),
  preview_url: z.string().url().optional().nullable(),
  status: z.nativeEnum(CONTENT_STATUS).default(CONTENT_STATUS.DRAFT),
  sort: z.number().int().default(0),
});

export const RoomTypeFieldsSchema = z.object({
  code: z.string().min(2).max(30).regex(/^[a-z_]+$/),
  name: TranslatedSchema,
  min_area: z.number().min(1).max(100),
  max_area: z.number().min(2).max(200),
  ideal_ratio: z.number().min(1).max(6).default(1.4),
  needs_exterior_wall: z.boolean().default(true),
  is_wet_zone: z.boolean().default(false),
  access_from: z.array(z.string()).default([]),
  furniture_tags: z.array(z.string()).default([]),
  selectable: z.boolean().default(false),
  max_count: z.number().int().min(1).max(20).default(8),
  default_count: z.number().int().min(0).max(20).default(0),
  sort: z.number().int().default(0),
});

export const RoomTypeInputSchema = RoomTypeFieldsSchema.refine(
  (input) => input.max_area > input.min_area,
  {
    message: 'VALIDATION_AREA_RANGE',
    path: ['max_area'],
  },
).refine((input) => input.default_count <= input.max_count, {
  message: 'VALIDATION_DEFAULT_COUNT',
  path: ['default_count'],
});

export const SkeletonFloorSchema = z.object({
  level: z.number().int().min(1).max(3),
  tree: TreeNodeSchema,
});

export const SkeletonInputSchema = z
  .object({
    name: z.string().min(1).max(120),
    floors: z.number().int().min(1).max(3),
    tree: z.object({ floors: z.array(SkeletonFloorSchema).min(1).max(3) }),
    tag_bedrooms: z.array(z.number().int().min(0).max(8)).default([]),
    tag_styles: z.array(z.string()).default([]),
    min_width: z.number().min(4).max(40),
    max_width: z.number().min(4).max(40),
    min_length: z.number().min(4).max(40),
    max_length: z.number().min(4).max(40),
    status: z.nativeEnum(CONTENT_STATUS).default(CONTENT_STATUS.DRAFT),
  })
  .refine((input) => input.max_width >= input.min_width && input.max_length >= input.min_length, {
    message: 'VALIDATION_SIZE_RANGE',
    path: ['max_width'],
  })
  .refine((input) => input.tree.floors.length === input.floors, {
    message: 'VALIDATION_TREE_FLOORS',
    path: ['tree'],
  });

export const FurnitureInputSchema = z.object({
  name: TranslatedSchema,
  gltf_url: z.string().url(),
  thumb_url: z.string().url().optional().nullable(),
  room_types: z.array(z.string()).default([]),
  style_tags: z.array(z.string()).default([]),
  footprint: z.object({
    width: z.number().min(0.1).max(10),
    depth: z.number().min(0.1).max(10),
    height: z.number().min(0.1).max(5),
  }),
  placement: z.enum(['WALL', 'CENTER', 'CORNER']).default('WALL'),
  active: z.boolean().default(true),
});

export type RoofStyleInput = z.infer<typeof RoofStyleInputSchema>;
export type StyleInput = z.infer<typeof StyleInputSchema>;
export type RoomTypeInput = z.infer<typeof RoomTypeInputSchema>;
export type SkeletonInput = z.infer<typeof SkeletonInputSchema>;
export type FurnitureInput = z.infer<typeof FurnitureInputSchema>;
