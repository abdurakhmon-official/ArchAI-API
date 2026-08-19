import { areaByKind, envelope, placeExtras, requestsFrom } from '../extras';
import { buildHouse } from '../layout';
import { measure } from '../measure';
import { buildMesh } from '../mesh';
import type { Extra, Rect } from '../types';
import { BOUNDS, OPTIONS, sampleTree } from './fixtures';

const place = (requests: Parameters<typeof placeExtras>[0]['requests'], floors = 1, bounds = BOUNDS) =>
  placeExtras({ bounds, requests, floors });

const overlaps = (first: Rect, second: Rect) => {
  const x = Math.min(first.x + first.width, second.x + second.width) - Math.max(first.x, second.x);
  const y = Math.min(first.y + first.length, second.y + second.length) - Math.max(first.y, second.y);
  return x > 1e-6 && y > 1e-6;
};

describe('placing extra volumes', () => {
  it('places the garage beside the house', () => {
    const { extras } = place([{ kind: 'garage', count: 1 }]);

    expect(extras).toHaveLength(1);
    expect(extras[0].kind).toBe('garage');
    expect(extras[0].enclosed).toBe(true);
    expect(extras[0].side).not.toBeNull();
  });

  it('a two-car garage is twice as wide', () => {
    const one = place([{ kind: 'garage', count: 1 }]).extras[0];
    const two = place([{ kind: 'garage', count: 2 }]).extras[0];

    expect(two.area).toBeCloseTo(one.area * 2, 1);
  });

  it('the garage sits outside the house outline', () => {
    const { extras } = place([{ kind: 'garage', count: 1 }]);
    expect(overlaps(extras[0].rect, BOUNDS)).toBe(false);
  });

  it('volumes never overlap', () => {
    const { extras } = place([
      { kind: 'garage', count: 2 },
      { kind: 'terrace' },
      { kind: 'sauna' },
    ]);

    expect(extras.length).toBeGreaterThanOrEqual(2);

    for (let i = 0; i < extras.length; i++) {
      for (let j = i + 1; j < extras.length; j++) {
        if (extras[i].kind === 'basement' || extras[j].kind === 'basement') continue;
        expect(overlaps(extras[i].rect, extras[j].rect)).toBe(false);
      }
    }
  });

  it('moves to the other side when it does not fit', () => {
    // Uch marta garaj: birinchi tomon to'ladi, keyingilari boshqa tomonga.
    const { extras } = place([
      { kind: 'garage', count: 2 },
      { kind: 'sauna' },
      { kind: 'terrace' },
    ]);

    const sides = new Set(extras.map((extra) => extra.side));
    expect(sides.size).toBeGreaterThan(1);
  });

  describe('floor restriction', () => {
    it('a single-storey house gets no balcony', () => {
      const { extras, skipped } = place([{ kind: 'balcony' }], 1);

      expect(extras).toHaveLength(0);
      expect(skipped[0].kind).toBe('balcony');
      expect(skipped[0].reason).toMatch(/floor/);
    });

    it('a two-storey house gets a balcony', () => {
      const { extras } = place([{ kind: 'balcony' }], 2);

      expect(extras).toHaveLength(1);
      expect(extras[0].floor).toBe(2);
      expect(extras[0].enclosed).toBe(false);
    });
  });

  it('the basement is under the house — same outline, floor zero', () => {
    const { extras } = place([{ kind: 'basement' }]);

    expect(extras[0].floor).toBe(0);
    expect(extras[0].rect).toEqual(BOUNDS);
    expect(extras[0].area).toBeCloseTo(BOUNDS.width * BOUNDS.length, 1);
  });

  it('the pool does not touch the house', () => {
    const { extras } = place([{ kind: 'pool' }]);

    expect(extras[0].side).toBeNull();
    expect(overlaps(extras[0].rect, BOUNDS)).toBe(false);
  });

  it('says so plainly when there is no room left', () => {
    const tiny: Rect = { x: 0, y: 0, width: 5, length: 5 };
    const { extras, skipped } = place(
      [{ kind: 'garage', count: 1 }, { kind: 'sauna' }, { kind: 'terrace' }],
      1,
      tiny,
    );

    // Kichik uyda hammasi sig'maydi — qolganlari sababi bilan qaytadi.
    expect(extras.length + skipped.length).toBe(3);
  });

  it('an empty request gives an empty result', () => {
    const { extras, skipped } = place([]);
    expect(extras).toEqual([]);
    expect(skipped).toEqual([]);
  });

  describe('enclosing rectangle', () => {
    it('bounds stay put on a house with no volumes', () => {
      expect(envelope(BOUNDS, [])).toEqual(BOUNDS);
    });

    it('widens when a garage is added', () => {
      const { extras, outerBounds } = place([{ kind: 'garage', count: 1 }]);

      expect(outerBounds.width * outerBounds.length).toBeGreaterThan(BOUNDS.width * BOUNDS.length);
      for (const extra of extras) {
        expect(extra.rect.x).toBeGreaterThanOrEqual(outerBounds.x - 1e-6);
        expect(extra.rect.y).toBeGreaterThanOrEqual(outerBounds.y - 1e-6);
      }
    });
  });

  describe('from constructor parameters to a request', () => {
    it('passes the garage count through', () => {
      expect(requestsFrom(2, [])).toEqual([{ kind: 'garage', count: 2 }]);
    });

    it('no garage is requested when there is none', () => {
      expect(requestsFrom(0, ['terrace'])).toEqual([{ kind: 'terrace' }]);
    });

    it('ignores an unknown type', () => {
      expect(requestsFrom(0, ['terrace', 'helipad'])).toEqual([{ kind: 'terrace' }]);
    });
  });
});

describe('volumes reach the estimate', () => {
  const build = (extras: Parameters<typeof placeExtras>[0]['requests'], floors = 1) =>
    buildHouse(
      {
        bounds: BOUNDS,
        floors: Array.from({ length: floors }, (_, index) => ({
          level: index + 1,
          tree: sampleTree(),
        })),
        extras,
      },
      OPTIONS,
    );

  it('the garage area shows up in the measurements', () => {
    const withGarage = measure(build([{ kind: 'garage', count: 1 }]).house);
    const without = measure(build([]).house);

    expect(without.GARAGE_AREA).toBe(0);
    expect(withGarage.GARAGE_AREA).toBeGreaterThan(0);
  });

  it('each type is measured separately', () => {
    const { house } = build([{ kind: 'garage', count: 1 }, { kind: 'terrace' }, { kind: 'basement' }]);
    const m = measure(house);

    expect(m.GARAGE_AREA).toBeGreaterThan(0);
    expect(m.TERRACE_AREA).toBeGreaterThan(0);
    expect(m.BASEMENT_AREA).toBeGreaterThan(0);
    expect(m.BALCONY_AREA).toBe(0);
    expect(m.POOL_AREA).toBe(0);
  });

  it('volumes leave the house area unchanged', () => {
    // Garaj yashash maydoni emas — `FLOOR_AREA` ga qo'shilmasligi kerak.
    const withGarage = measure(build([{ kind: 'garage', count: 2 }]).house);
    const without = measure(build([]).house);

    expect(withGarage.FLOOR_AREA).toBeCloseTo(without.FLOOR_AREA, 1);
    expect(withGarage.ROOF_AREA).toBeCloseTo(without.ROOF_AREA, 1);
  });

  it('reports the volumes that did not fit', () => {
    const { skippedExtras } = build([{ kind: 'balcony' }], 1);
    expect(skippedExtras.map((item) => item.kind)).toContain('balcony');
  });

  it('the running total is correct', () => {
    const extras: Extra[] = [
      { id: 'x1', kind: 'garage', rect: BOUNDS, floor: 1, side: 'west', enclosed: true, area: 21.6 },
      { id: 'x2', kind: 'garage', rect: BOUNDS, floor: 1, side: 'east', enclosed: true, area: 18 },
      { id: 'x3', kind: 'terrace', rect: BOUNDS, floor: 1, side: 'north', enclosed: false, area: 12 },
    ];

    expect(areaByKind(extras, 'garage')).toBeCloseTo(39.6, 2);
    expect(areaByKind(extras, 'terrace')).toBeCloseTo(12, 2);
    expect(areaByKind(extras, 'pool')).toBe(0);
  });
});

describe('volumes reach the 3D model', () => {
  it('a garage adds triangles', () => {
    const bare = buildMesh(
      buildHouse({ bounds: BOUNDS, floors: [{ level: 1, tree: sampleTree() }] }, OPTIONS).house,
    );
    const withGarage = buildMesh(
      buildHouse(
        {
          bounds: BOUNDS,
          floors: [{ level: 1, tree: sampleTree() }],
          extras: [{ kind: 'garage', count: 1 }],
        },
        OPTIONS,
      ).house,
    );

    expect(withGarage.triangleCount).toBeGreaterThan(bare.triangleCount);
  });

  it('the basement goes below ground', () => {
    const { house } = buildHouse(
      {
        bounds: BOUNDS,
        floors: [{ level: 1, tree: sampleTree() }],
        extras: [{ kind: 'basement' }],
      },
      OPTIONS,
    );

    const mesh = buildMesh(house);
    expect(mesh.bbox.min.z).toBeLessThan(-1);
  });
});
