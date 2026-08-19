import { applyRoomProgram, type ProgramSteps } from '@/geometry/program';
import { computeRooms, countByType, leaves } from '@/geometry/tree';
import type { Rect, RoomTypeRule, TreeNode } from '@/geometry/types';

/**
 * Xona dasturi — skeletdagi xonalar sonini foydalanuvchi so'roviga
 * keltirish. Bu generatsiya quvurining eng nozik qadami: bu yerda xato
 * bo'lsa, foydalanuvchi "4 xonali" deb so'rab 3 xonali uy oladi.
 */

const RULES: Record<string, RoomTypeRule> = {
  living: { code: 'living', minArea: 16, maxArea: 45, idealRatio: 1.5, needsExteriorWall: true, isWetZone: false, accessFrom: [] },
  bedroom: { code: 'bedroom', minArea: 9, maxArea: 25, idealRatio: 1.3, needsExteriorWall: true, isWetZone: false, accessFrom: [] },
  kitchen: { code: 'kitchen', minArea: 8, maxArea: 20, idealRatio: 1.4, needsExteriorWall: true, isWetZone: true, accessFrom: [] },
  bathroom: { code: 'bathroom', minArea: 3, maxArea: 8, idealRatio: 1.5, needsExteriorWall: false, isWetZone: true, accessFrom: [] },
  office: { code: 'office', minArea: 7, maxArea: 20, idealRatio: 1.3, needsExteriorWall: true, isWetZone: false, accessFrom: [] },
};

const OPTIONS = { rules: RULES };
const BOUNDS: Rect = { x: 0, y: 0, width: 12, length: 14 };

/** Ikki yotoqxonali bazaviy skelet. */
function skeleton(): TreeNode {
  return {
    kind: 'split',
    id: 's1',
    axis: 'vertical',
    ratio: 0.55,
    children: [
      {
        kind: 'split',
        id: 's2',
        axis: 'horizontal',
        ratio: 0.6,
        children: [
          { kind: 'leaf', id: 'n1', roomType: 'living' },
          { kind: 'leaf', id: 'n2', roomType: 'kitchen' },
        ],
      },
      {
        kind: 'split',
        id: 's3',
        axis: 'horizontal',
        ratio: 0.5,
        children: [
          { kind: 'leaf', id: 'n3', roomType: 'bedroom' },
          { kind: 'leaf', id: 'n4', roomType: 'bedroom' },
        ],
      },
    ],
  };
}

const fresh = (): ProgramSteps => ({ roomsAdded: 0, roomsRemoved: 0, skipped: [] });

const totalArea = (trees: TreeNode[]) =>
  trees.reduce(
    (sum, tree) => sum + computeRooms(tree, BOUNDS).reduce((inner, room) => inner + room.area, 0),
    0,
  );

const countAcross = (trees: TreeNode[], roomType: string) =>
  trees.reduce((sum, tree) => sum + (countByType(tree)[roomType] ?? 0), 0);

describe('applying a room programme', () => {
  it('nothing changes when the requested count matches the skeleton', () => {
    const steps = fresh();
    const result = applyRoomProgram(
      [skeleton()],
      BOUNDS,
      { bedroom: 2, living: 1, bathroom: 0, office: 0, dining: 0 },
      OPTIONS,
      steps,
    );

    expect(countAcross(result, 'bedroom')).toBe(2);
    expect(steps).toEqual({ roomsAdded: 0, roomsRemoved: 0, skipped: [] });
  });

  it('adds the missing bedrooms', () => {
    const steps = fresh();
    const result = applyRoomProgram(
      [skeleton()],
      BOUNDS,
      { bedroom: 4, living: 1, bathroom: 0, office: 0, dining: 0 },
      OPTIONS,
      steps,
    );

    expect(countAcross(result, 'bedroom')).toBe(4);
    expect(steps.roomsAdded).toBe(2);
  });

  it('removes the extra bedroom', () => {
    const steps = fresh();
    const result = applyRoomProgram(
      [skeleton()],
      BOUNDS,
      { bedroom: 1, living: 1, bathroom: 0, office: 0, dining: 0 },
      OPTIONS,
      steps,
    );

    expect(countAcross(result, 'bedroom')).toBe(1);
    expect(steps.roomsRemoved).toBe(1);
  });

  it('can add a room type the skeleton does not have', () => {
    const steps = fresh();
    const result = applyRoomProgram(
      [skeleton()],
      BOUNDS,
      { bedroom: 2, living: 1, bathroom: 1, office: 1, dining: 0 },
      OPTIONS,
      steps,
    );

    expect(countAcross(result, 'bathroom')).toBe(1);
    expect(countAcross(result, 'office')).toBe(1);
  });

  it('keeps the total area', () => {
    const steps = fresh();
    const result = applyRoomProgram(
      [skeleton()],
      BOUNDS,
      { bedroom: 4, living: 1, bathroom: 1, office: 0, dining: 0 },
      OPTIONS,
      steps,
    );

    expect(totalArea(result)).toBeCloseTo(BOUNDS.width * BOUNDS.length, 1);
  });

  it('leaves the original skeleton untouched', () => {
    const original = skeleton();
    applyRoomProgram(
      [original],
      BOUNDS,
      { bedroom: 4, living: 1, bathroom: 1, office: 0, dining: 0 },
      OPTIONS,
      fresh(),
    );

    expect(leaves(original)).toHaveLength(4);
  });

  it('every room stays above the minimum area', () => {
    const result = applyRoomProgram(
      [skeleton()],
      BOUNDS,
      { bedroom: 4, living: 1, bathroom: 1, office: 0, dining: 0 },
      OPTIONS,
      fresh(),
    );

    for (const tree of result) {
      for (const room of computeRooms(tree, BOUNDS)) {
        expect(room.area).toBeGreaterThanOrEqual(RULES[room.roomType].minArea);
      }
    }
  });

  it('does not retry forever when there is no room', () => {
    const tiny: Rect = { x: 0, y: 0, width: 6, length: 7 };
    const steps = fresh();

    const result = applyRoomProgram(
      [skeleton()],
      tiny,
      { bedroom: 8, living: 1, bathroom: 0, office: 0, dining: 0 },
      OPTIONS,
      steps,
    );

    // Hammasi sig'masligi mumkin, lekin funksiya to'xtashi va
    // yaroqli daraxt qaytarishi shart.
    expect(result).toHaveLength(1);
    expect(leaves(result[0]).length).toBeGreaterThan(0);
  });

  describe('multi-storey house', () => {
    it('counts rooms across the whole house', () => {
      const steps = fresh();
      const result = applyRoomProgram(
        [skeleton(), skeleton()],
        BOUNDS,
        { bedroom: 5, living: 2, bathroom: 0, office: 0, dining: 0 },
        OPTIONS,
        steps,
      );

      // Ikki qavatda jami 4 ta yotoqxona bor edi, 5 ta so'raldi.
      expect(countAcross(result, 'bedroom')).toBe(5);
      expect(steps.roomsAdded).toBe(1);
    });

    it('each floor stays its own tree', () => {
      const result = applyRoomProgram(
        [skeleton(), skeleton()],
        BOUNDS,
        { bedroom: 6, living: 2, bathroom: 0, office: 0, dining: 0 },
        OPTIONS,
        fresh(),
      );

      expect(result).toHaveLength(2);
      for (const tree of result) {
        expect(computeRooms(tree, BOUNDS).reduce((sum, room) => sum + room.area, 0)).toBeCloseTo(
          BOUNDS.width * BOUNDS.length,
          1,
        );
      }
    });
  });
});

/**
 * Sig'magan xonalar.
 *
 * Ilgari `addRoom` xato tashlaganda sikl jimgina `break` qilardi va
 * hech qanday iz qolmasdi: foydalanuvchi 5 ta yotoqxona so'rab 2
 * tasini olardi va nima uchunligini bilmasdi.
 */
describe('rooms that did not fit are recorded', () => {
  /** Kichkina yer — unga ko'p xona sig'maydi. */
  const TIGHT: Rect = { x: 0, y: 0, width: 6, length: 6 };

  it('the list stays empty when everything fits', () => {
    const steps = fresh();
    applyRoomProgram([skeleton()], BOUNDS, { bedroom: 2 }, OPTIONS, steps);

    expect(steps.skipped).toEqual([]);
  });

  it('a room that did not fit is recorded', () => {
    const steps = fresh();
    // 6 × 6 m — 36 m². Bunga sakkizta yotoqxona hech qachon sig'maydi.
    applyRoomProgram([skeleton()], TIGHT, { bedroom: 8 }, OPTIONS, steps);

    expect(steps.skipped).toHaveLength(1);
    expect(steps.skipped[0].roomType).toBe('bedroom');
    expect(steps.skipped[0].wanted).toBe(8);
    expect(steps.skipped[0].placed).toBeLessThan(8);
  });

  it('the reason is reported as "no room left"', () => {
    const steps = fresh();
    applyRoomProgram([skeleton()], TIGHT, { bedroom: 8 }, OPTIONS, steps);

    // Aynan shu sababni foydalanuvchiga tushunarli qilib aytish mumkin;
    // boshqa sabablarni "sig'madi" deb ko'rsatish yolg'on bo'lardi.
    expect(steps.skipped[0].reason).toBe('NO_SPACE');
  });

  it('the placed count reflects reality', () => {
    const steps = fresh();
    const result = applyRoomProgram([skeleton()], TIGHT, { bedroom: 8 }, OPTIONS, steps);

    const actual = result.reduce((sum, tree) => sum + (countByType(tree).bedroom ?? 0), 0);
    expect(steps.skipped[0].placed).toBe(actual);
  });

  it('several types are recorded separately', () => {
    const steps = fresh();
    applyRoomProgram([skeleton()], TIGHT, { bedroom: 6, office: 4 }, OPTIONS, steps);

    const types = steps.skipped.map((item) => item.roomType).sort();
    expect(types).toEqual(['bedroom', 'office']);
  });
});
