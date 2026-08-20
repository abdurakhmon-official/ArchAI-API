import type { LayoutRules, RoofSpec, RoofType } from '@/geometry/types';

interface StyleConfig {
  id: string;
  slug: string;
  roof: RoofSpec;
  layout: LayoutRules;
  facade: Record<string, unknown>;
  window: Record<string, unknown>;
  interior: Record<string, unknown>;
}

interface StyleRow {
  id: string;
  slug: string;
  roof: unknown;
  facade: unknown;
  window: unknown;
  interior: unknown;
  layoutRules: unknown;
  roofStyle?: RoofStyleRow | null;
}

interface RoofStyleRow {
  family: RoofType;
  pitch: number;
  overhang: number;
  upperPitch: number | null;
  breakRatio: number | null;
}

export type { StyleConfig, StyleRow, RoofStyleRow };
