import { z } from 'zod';

export const TreeNodeSchema: z.ZodType<unknown> = z.lazy(() =>
  z.union([
    z.object({
      kind: z.literal('leaf'),
      id: z.string().min(1),
      roomType: z.string().min(1),
      label: z.string().max(60).optional(),
    }),
    z.object({
      kind: z.literal('split'),
      id: z.string().min(1),
      axis: z.enum(['vertical', 'horizontal']),
      ratio: z.number().min(0.01).max(0.99),
      children: z.tuple([TreeNodeSchema, TreeNodeSchema]),
    }),
  ]),
);

export const RectSchema = z.object({
  x: z.number(),
  y: z.number(),
  width: z.number().min(1).max(60),
  length: z.number().min(1).max(60),
});

export const FloorGeometrySchema = z.object({
  level: z.number().int().min(1).max(3),
  tree: TreeNodeSchema,
});

export const ExtraRequestSchema = z.object({
  kind: z.enum(['garage', 'terrace', 'balcony', 'basement', 'sauna', 'pool']),
  count: z.number().int().min(1).max(3).optional(),
});

export const GeometryStateSchema = z.object({
  bounds: RectSchema,
  floors: z.array(FloorGeometrySchema).min(1).max(3),
  styleSlug: z.string().optional(),
  extras: z.array(ExtraRequestSchema).max(8).default([]),
});

export const AddRoomInputSchema = z.object({
  geometry: GeometryStateSchema,
  level: z.number().int().min(1).max(3).default(1),
  roomType: z.string().min(1),
});

export const RemoveRoomInputSchema = z.object({
  geometry: GeometryStateSchema,
  level: z.number().int().min(1).max(3).default(1),
  roomId: z.string().min(1),
});

export const ChangeRoomTypeInputSchema = z.object({
  geometry: GeometryStateSchema,
  level: z.number().int().min(1).max(3).default(1),
  roomId: z.string().min(1),
  roomType: z.string().min(1),
});

export const MoveWallInputSchema = z.object({
  geometry: GeometryStateSchema,
  level: z.number().int().min(1).max(3).default(1),
  splitId: z.string().min(1),
  ratio: z.number().min(0.05).max(0.95),
});

export const ResizeInputSchema = z.object({
  geometry: GeometryStateSchema,
  width: z.number().min(4).max(40),
  length: z.number().min(4).max(40),
});

export type GeometryState = z.infer<typeof GeometryStateSchema>;
export type AddRoomInput = z.infer<typeof AddRoomInputSchema>;
export type RemoveRoomInput = z.infer<typeof RemoveRoomInputSchema>;
export type ChangeRoomTypeInput = z.infer<typeof ChangeRoomTypeInputSchema>;
export type MoveWallInput = z.infer<typeof MoveWallInputSchema>;
export type ResizeInput = z.infer<typeof ResizeInputSchema>;
