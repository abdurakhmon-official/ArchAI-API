import type { MeshMaterial } from '../geometry/types';

export interface MaterialSpec {
  color: string;
  roughness: number;
  metalness?: number;
  opacity?: number;
}

export type Palette = Record<MeshMaterial, MaterialSpec>;

export const DEFAULT_PALETTE: Palette = {
  'wall-exterior': { color: '#e9e6e0', roughness: 0.9 },
  'wall-interior': { color: '#f3f1ee', roughness: 0.95 },
  floor: { color: '#cbb79c', roughness: 0.8 },
  ceiling: { color: '#fbfbfa', roughness: 1 },
  roof: { color: '#7a6a5c', roughness: 0.7 },
  glass: { color: '#9fc4d8', roughness: 0.1, metalness: 0.2, opacity: 0.45 },
  door: { color: '#8a6a4a', roughness: 0.6 },
  stairs: { color: '#b8a48c', roughness: 0.8 },
};

export const FLOOR_FINISHES: Record<string, MaterialSpec> = {
  laminate: { color: '#c9ab86', roughness: 0.75 },
  parquet: { color: '#a97b4f', roughness: 0.6 },
  tile: { color: '#d8d5cf', roughness: 0.35 },
  concrete: { color: '#b6b4b0', roughness: 0.9 },
  carpet: { color: '#9b8f84', roughness: 1 },
  stone: { color: '#9e9a94', roughness: 0.55 },
};

export interface StyleAppearance {
  facade?: { primary?: string; accent?: string; plinth?: string } | null;
  interior?: {
    wallColor?: string;
    skirting?: string;
    floorByRoomType?: Record<string, string>;
  } | null;
  window?: { frameColor?: string } | null;
  roofColor?: string | null;
}

export function paletteFrom(style: StyleAppearance | null | undefined): Palette {
  if (!style) return DEFAULT_PALETTE;

  const facade = style.facade ?? {};
  const interior = style.interior ?? {};
  const window = style.window ?? {};

  return {
    ...DEFAULT_PALETTE,
    'wall-exterior': {
      color: facade.primary ?? DEFAULT_PALETTE['wall-exterior'].color,
      roughness: DEFAULT_PALETTE['wall-exterior'].roughness,
    },
    'wall-interior': {
      color: interior.wallColor ?? DEFAULT_PALETTE['wall-interior'].color,
      roughness: DEFAULT_PALETTE['wall-interior'].roughness,
    },
    roof: {
      color: style.roofColor ?? DEFAULT_PALETTE.roof.color,
      roughness: DEFAULT_PALETTE.roof.roughness,
    },
    door: {
      color: window.frameColor ?? facade.accent ?? DEFAULT_PALETTE.door.color,
      roughness: DEFAULT_PALETTE.door.roughness,
    },
    ceiling: {
      color: interior.skirting ?? DEFAULT_PALETTE.ceiling.color,
      roughness: DEFAULT_PALETTE.ceiling.roughness,
    },
  };
}

export function floorSpecFor(
  style: StyleAppearance | null | undefined,
  roomType: string | undefined,
  palette: Palette,
): MaterialSpec {
  const finish = roomType ? style?.interior?.floorByRoomType?.[roomType] : undefined;
  return (finish ? FLOOR_FINISHES[finish] : undefined) ?? palette.floor;
}
