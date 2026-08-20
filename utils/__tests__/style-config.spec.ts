import { toConfig } from '../style-config';
import { DEFAULT_LAYOUT_RULES } from '@/geometry/types';
import type { StyleRow } from '@/types/style.types';

/**
 * `toConfig` feeds the geometry generator: a wrong field here changes
 * the roof or room layout silently, with no error to catch it.
 */

const row = (over: Partial<StyleRow> = {}): StyleRow => ({
  id: 'style-1',
  slug: 'modern',
  roof: null,
  facade: null,
  window: null,
  interior: null,
  layoutRules: null,
  roofStyle: null,
  ...over,
});

describe('toConfig', () => {
  it('takes the roof from the roofStyle preset when one is set', () => {
    const config = toConfig(
      row({
        roofStyle: { family: 'mansard', pitch: 45, overhang: 0.6, upperPitch: 20, breakRatio: 0.4 },
      }),
    );

    expect(config.roof).toEqual({
      type: 'mansard',
      pitch: 45,
      overhang: 0.6,
      upperPitch: 20,
      breakRatio: 0.4,
    });
  });

  it('omits upperPitch and breakRatio when the preset has none', () => {
    const config = toConfig(
      row({ roofStyle: { family: 'gable', pitch: 30, overhang: 0.5, upperPitch: null, breakRatio: null } }),
    );

    expect(config.roof).toEqual({ type: 'gable', pitch: 30, overhang: 0.5 });
  });

  it('falls back to the raw roof JSON when there is no preset', () => {
    const config = toConfig(row({ roof: { type: 'hip', pitch: 35, overhang: 0.7 } }));

    expect(config.roof).toEqual({ type: 'hip', pitch: 35, overhang: 0.7 });
  });

  it('falls back to gable defaults when neither preset nor raw roof is set', () => {
    expect(toConfig(row()).roof).toEqual({ type: 'gable', pitch: 25, overhang: 0.5 });
  });

  it('fills layout with defaults when layoutRules is empty', () => {
    expect(toConfig(row()).layout).toEqual(DEFAULT_LAYOUT_RULES);
  });

  it('overrides layout fields present in layoutRules', () => {
    const config = toConfig(row({ layoutRules: { corridorWidth: 1.6, openKitchen: true } }));

    expect(config.layout.corridorWidth).toBe(1.6);
    expect(config.layout.openKitchen).toBe(true);
    expect(config.layout.minAreaFactor).toBe(DEFAULT_LAYOUT_RULES.minAreaFactor);
  });

  it('takes ceiling height from interior and window ratio from window', () => {
    const config = toConfig(
      row({ interior: { ceilingHeight: 3.2 }, window: { wallAreaRatio: 0.25 } }),
    );

    expect(config.layout.ceilingHeight).toBe(3.2);
    expect(config.layout.windowWallAreaRatio).toBe(0.25);
  });

  it('defaults facade, window and interior to empty objects', () => {
    const config = toConfig(row());

    expect(config.facade).toEqual({});
    expect(config.window).toEqual({});
    expect(config.interior).toEqual({});
  });
});
