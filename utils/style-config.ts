import type { StyleConfig, StyleRow } from '@/types/style.types';
import { DEFAULT_LAYOUT_RULES, type LayoutRules, type RoofSpec } from '@/geometry/types';

function roofSpecOf(style: StyleRow): RoofSpec {
  const preset = style.roof_style;

  if (preset) {
    return {
      type: preset.family,
      pitch: preset.pitch,
      overhang: preset.overhang,
      ...(preset.upper_pitch !== null ? { upperPitch: preset.upper_pitch } : {}),
      ...(preset.break_ratio !== null ? { breakRatio: preset.break_ratio } : {}),
    };
  }

  const roof = (style.roof ?? {}) as Partial<RoofSpec>;

  return {
    type: roof.type ?? 'gable',
    pitch: roof.pitch ?? 25,
    overhang: roof.overhang ?? 0.5,
    ...(roof.upperPitch !== undefined ? { upperPitch: roof.upperPitch } : {}),
    ...(roof.breakRatio !== undefined ? { breakRatio: roof.breakRatio } : {}),
  };
}

function toConfig(style: StyleRow): StyleConfig {
  const interior = (style.interior ?? {}) as { ceilingHeight?: number };
  const layout = (style.layout_rules ?? {}) as Partial<LayoutRules>;
  const window = (style.window ?? {}) as { wallAreaRatio?: number };

  return {
    id: style.id,
    slug: style.slug,
    roof: roofSpecOf(style),
    layout: {
      ...DEFAULT_LAYOUT_RULES,
      corridorWidth: layout.corridorWidth ?? DEFAULT_LAYOUT_RULES.corridorWidth,
      openKitchen: layout.openKitchen ?? DEFAULT_LAYOUT_RULES.openKitchen,
      minAreaFactor: layout.minAreaFactor ?? DEFAULT_LAYOUT_RULES.minAreaFactor,
      ceilingHeight: interior.ceilingHeight ?? DEFAULT_LAYOUT_RULES.ceilingHeight,
      windowWallAreaRatio: window.wallAreaRatio ?? DEFAULT_LAYOUT_RULES.windowWallAreaRatio,
    },
    facade: (style.facade ?? {}) as Record<string, unknown>,
    window: (style.window ?? {}) as Record<string, unknown>,
    interior: (style.interior ?? {}) as Record<string, unknown>,
  };
}

export { toConfig };
