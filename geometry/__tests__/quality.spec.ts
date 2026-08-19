import { carveCorridor, ensureCirculation } from '../corridor';
import { buildHouse } from '../layout';
import { fitAndRebalance, rebalance } from '../resize';
import { addRoom, MAX_ROOM_RATIO } from '../split';
import { computeRooms, countByType, leaves } from '../tree';
import type { Rect, RoomTypeRule, TreeNode } from '../types';
import { validateHouse } from '../validate';
import { BOUNDS, OPTIONS, RULES, sampleTree } from './fixtures';

/** Namuna daraxt shu o'lchamda hech qanday cheklovni buzmaydi. */
const TIGHT: Rect = { x: 0, y: 0, width: 9, length: 10 };
/** Bu o'lchamda 5 xona uchun joy haddan ziyod — xonalar chegaradan oshadi. */
const BIG: Rect = { x: 0, y: 0, width: 16, length: 18 };

/**
 * Qat'iyroq qoidalar: yotoqxonaga faqat koridor yoki kirish xonasidan
 * kirish mumkin. Namuna daraxtda koridor yo'q, shuning uchun yotoqxonalar
 * ulanmay qoladi — aynan koridor generatsiyasi hal qiladigan holat.
 */
const STRICT_RULES: Record<string, RoomTypeRule> = {
  ...RULES,
  bedroom: { ...RULES.bedroom, accessFrom: ['corridor', 'hall'] },
};
const STRICT = { rules: STRICT_RULES };

const worstRatio = (tree: TreeNode, bounds: Rect) =>
  Math.max(...computeRooms(tree, bounds).map((room) => room.ratio));

const areasOf = (tree: TreeNode, bounds: Rect) =>
  Object.fromEntries(computeRooms(tree, bounds).map((room) => [room.id, room.area]));

const roomOfType = (tree: TreeNode, bounds: Rect, type: string) =>
  computeRooms(tree, bounds).find((room) => room.roomType === type)!;

const errorsOf = (tree: TreeNode, bounds: Rect) =>
  validateHouse(buildHouse({ bounds, floors: [{ level: 1, tree }] }, OPTIONS).house, OPTIONS)
    .issues.filter((issue) => issue.severity === 'error');

function countViolations(tree: TreeNode, bounds: Rect): number {
  return computeRooms(tree, bounds).filter((room) => {
    const rule = RULES[room.roomType];
    return rule && (room.area < rule.minArea || room.area > rule.maxArea * 1.6);
  }).length;
}

// ===========================================================================

describe('never producing a flat room', () => {
  it('proportions survive adding a room', () => {
    let tree = sampleTree();

    for (let i = 0; i < 3; i++) {
      tree = addRoom(tree, BOUNDS, 'bedroom', OPTIONS);
      expect(worstRatio(tree, BOUNDS)).toBeLessThanOrEqual(MAX_ROOM_RATIO);
    }
  });

  it('picks the cut direction that gives the flatter result', () => {
    // Cho'ziq xona: uzun tomonni kesish yana yassiroq natija berardi.
    const narrow: TreeNode = { kind: 'leaf', id: 'n1', roomType: 'living' };
    const bounds: Rect = { x: 0, y: 0, width: 4, length: 16 };

    const after = addRoom(narrow, bounds, 'bedroom', OPTIONS);
    expect(worstRatio(after, bounds)).toBeLessThan(worstRatio(narrow, bounds));
  });

  it('adding introduces no new error', () => {
    const before = errorsOf(sampleTree(), BOUNDS).length;
    const after = errorsOf(addRoom(sampleTree(), BOUNDS, 'bedroom', OPTIONS), BOUNDS).length;

    expect(after).toBeLessThanOrEqual(before);
  });
});

// ===========================================================================

describe('redistributing area', () => {
  it('hands out spare area by the growth budget', () => {
    const before = roomOfType(sampleTree(), BIG, 'bathroom');
    const after = roomOfType(rebalance(sampleTree(), BIG, OPTIONS), BIG, 'bathroom');

    // Sanuzelning o'sish zaxirasi kichik — u mehmonxonaga qaraganda
    // ancha kam o'sishi kerak.
    expect(after.area).toBeLessThan(before.area);
  });

  it('the bathroom stays the smallest room', () => {
    const rooms = computeRooms(rebalance(sampleTree(), BIG, OPTIONS), BIG);
    const bathroom = rooms.find((room) => room.roomType === 'bathroom')!;

    for (const room of rooms) {
      if (room.roomType === 'bathroom') continue;
      expect(bathroom.area).toBeLessThan(room.area);
    }
  });

  it('keeps the total area', () => {
    const total = computeRooms(rebalance(sampleTree(), BIG, OPTIONS), BIG).reduce(
      (sum, room) => sum + room.area,
      0,
    );
    expect(total).toBeCloseTo(BIG.width * BIG.length, 1);
  });

  it('at strength 0 the author ratios stay put', () => {
    const untouched = rebalance(sampleTree(), BIG, OPTIONS, 0);
    expect(areasOf(untouched, BIG)).toEqual(areasOf(sampleTree(), BIG));
  });

  it('the change grows with the strength', () => {
    const bathroomAt = (strength: number) =>
      roomOfType(rebalance(sampleTree(), BIG, OPTIONS, strength), BIG, 'bathroom').area;

    expect(bathroomAt(0.5)).toBeLessThan(bathroomAt(0));
    expect(bathroomAt(1)).toBeLessThan(bathroomAt(0.5));
  });

  it('protects the minimum areas in a narrow house', () => {
    const balanced = rebalance(sampleTree(), TIGHT, OPTIONS);

    for (const room of computeRooms(balanced, TIGHT)) {
      expect(room.area).toBeGreaterThanOrEqual(RULES[room.roomType].minArea);
    }
  });

  describe('automatic fitting', () => {
    it('leaves the tree alone when nothing is violated', () => {
      const result = fitAndRebalance(sampleTree(), TIGHT, OPTIONS);

      expect(result.adjusted).toBe(false);
      expect(areasOf(result.tree, TIGHT)).toEqual(areasOf(sampleTree(), TIGHT));
    });

    it('steps in on a violation and never makes it worse', () => {
      const before = countViolations(sampleTree(), BIG);
      const result = fitAndRebalance(sampleTree(), BIG, OPTIONS);

      expect(result.adjusted).toBe(true);
      expect(countViolations(result.tree, BIG)).toBeLessThanOrEqual(before);
    });

    it('geometry alone cannot fix an oversized house', () => {
      // 5 xona uchun 288 m² — har biriga o'rtacha 57 m². Nisbatlarni
      // qanday qo'ymang, xonalar chegaradan oshadi. To'g'ri yechim —
      // generator xona qo'shishi; bu geometriyaning emas, S5 ning ishi.
      const result = fitAndRebalance(sampleTree(), BIG, OPTIONS);
      expect(countViolations(result.tree, BIG)).toBeGreaterThan(0);
    });
  });
});

// ===========================================================================

describe('corridor generation', () => {
  describe('carving a strip', () => {
    it('cuts a corridor out of a leaf', () => {
      const tree = carveCorridor(sampleTree(), BOUNDS, 'n1', OPTIONS, 'vertical', 'end');

      expect(countByType(tree).corridor).toBe(1);
      expect(leaves(tree)).toHaveLength(6);
    });

    it('the corridor width is close to the one requested', () => {
      const tree = carveCorridor(
        sampleTree(),
        BOUNDS,
        'n1',
        { ...OPTIONS, corridorWidth: 1.4 },
        'vertical',
        'end',
      );
      const corridor = roomOfType(tree, BOUNDS, 'corridor');

      expect(corridor.rect.width).toBeCloseTo(1.4, 1);
    });

    it('the strip is taken from the chosen side', () => {
      const host = computeRooms(sampleTree(), BOUNDS).find((room) => room.id === 'n1')!;

      const atEnd = roomOfType(
        carveCorridor(sampleTree(), BOUNDS, 'n1', OPTIONS, 'vertical', 'end'),
        BOUNDS,
        'corridor',
      );
      const atStart = roomOfType(
        carveCorridor(sampleTree(), BOUNDS, 'n1', OPTIONS, 'vertical', 'start'),
        BOUNDS,
        'corridor',
      );

      expect(atEnd.rect.x).toBeGreaterThan(atStart.rect.x);
      expect(atStart.rect.x).toBeCloseTo(host.rect.x, 2);
    });

    it('the total area is kept', () => {
      const tree = carveCorridor(sampleTree(), BOUNDS, 'n1', OPTIONS, 'vertical', 'end');
      const total = computeRooms(tree, BOUNDS).reduce((sum, room) => sum + room.area, 0);

      expect(total).toBeCloseTo(BOUNDS.width * BOUNDS.length, 1);
    });

    it('carves no strip out of a small room', () => {
      const tiny: TreeNode = { kind: 'leaf', id: 'n1', roomType: 'bathroom' };
      expect(() =>
        carveCorridor(tiny, { x: 0, y: 0, width: 2, length: 2 }, 'n1', OPTIONS, 'vertical', 'end'),
      ).toThrow(/corridor/);
    });
  });

  describe('guaranteeing a walking route', () => {
    it('no corridor is needed under relaxed rules', () => {
      // Yotoqxonaga istalgan xonadan kirish mumkin — hammasi allaqachon ulangan.
      const result = ensureCirculation(sampleTree(), BOUNDS, OPTIONS);

      expect(result.carved).toBe(0);
      expect(result.unreachable).toEqual([]);
    });

    it('finds an unconnected room under strict rules and builds a corridor', () => {
      const result = ensureCirculation(sampleTree(), BOUNDS, STRICT);

      expect(result.carved).toBeGreaterThan(0);
      expect(countByType(result.tree).corridor).toBeGreaterThan(0);
    });

    it('no room is left unconnected after the corridor', () => {
      const result = ensureCirculation(sampleTree(), BOUNDS, STRICT);
      expect(result.unreachable).toEqual([]);
    });

    it('clears the "access through room" warnings', () => {
      const warningsOf = (tree: TreeNode) =>
        validateHouse(
          buildHouse({ bounds: BOUNDS, floors: [{ level: 1, tree }] }, STRICT).house,
          STRICT,
        ).issues.filter((issue) => issue.code === 'INVALID_ACCESS_SOURCE').length;

      const before = warningsOf(sampleTree());
      const after = warningsOf(ensureCirculation(sampleTree(), BOUNDS, STRICT).tree);

      expect(before).toBeGreaterThan(0);
      expect(after).toBeLessThan(before);
    });

    it('adds nothing on a second call', () => {
      const first = ensureCirculation(sampleTree(), BOUNDS, STRICT).tree;
      const second = ensureCirculation(first, BOUNDS, STRICT);

      expect(second.carved).toBe(0);
      expect(leaves(second.tree)).toHaveLength(leaves(first).length);
    });

    it('keeps the total area', () => {
      const result = ensureCirculation(sampleTree(), BOUNDS, STRICT);
      const total = computeRooms(result.tree, BOUNDS).reduce((sum, room) => sum + room.area, 0);

      expect(total).toBeCloseTo(BOUNDS.width * BOUNDS.length, 1);
    });
  });
});

// ===========================================================================

describe('the full pipeline: corridor plus redistribution', () => {
  it('raises the quality score under strict rules', () => {
    const scoreOf = (tree: TreeNode, bounds: Rect) =>
      validateHouse(
        buildHouse({ bounds, floors: [{ level: 1, tree }] }, STRICT).house,
        STRICT,
      ).score;

    const raw = sampleTree();
    const circulated = ensureCirculation(raw, BOUNDS, STRICT).tree;
    const balanced = fitAndRebalance(circulated, BOUNDS, STRICT).tree;

    expect(scoreOf(balanced, BOUNDS)).toBeGreaterThan(scoreOf(raw, BOUNDS));
  });

  it('gives an error-free plan in a narrow house', () => {
    const circulated = ensureCirculation(sampleTree(), TIGHT, STRICT).tree;
    const balanced = fitAndRebalance(circulated, TIGHT, STRICT).tree;

    const { house } = buildHouse({ bounds: TIGHT, floors: [{ level: 1, tree: balanced }] }, STRICT);
    const result = validateHouse(house, STRICT);

    expect(result.issues.filter((issue) => issue.severity === 'error')).toEqual([]);
  });
});
