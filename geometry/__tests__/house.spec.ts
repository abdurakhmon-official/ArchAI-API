import { buildHouse, pickStairs } from '../layout';
import { measure } from '../measure';
import { moveSplit } from '../resize';
import { addRoom } from '../split';
import { validateHouse } from '../validate';
import { BOUNDS, OPTIONS, sampleTree } from './fixtures';

const build = (tree = sampleTree(), bounds = BOUNDS) =>
  buildHouse({ bounds, floors: [{ level: 1, tree }] }, OPTIONS);

describe('building a house', () => {
  const { house } = build();
  const floor = house.floors[0];

  it('renders every room', () => {
    expect(floor.rooms).toHaveLength(5);
  });

  it('separates exterior and interior walls', () => {
    expect(floor.walls.some((w) => w.exterior)).toBe(true);
    expect(floor.walls.some((w) => !w.exterior)).toBe(true);
  });

  it('puts the entrance on the ground floor', () => {
    expect(floor.openings.filter((o) => o.kind === 'entrance')).toHaveLength(1);
  });

  it('every room has a way in', () => {
    const reachable = new Set<string>();
    for (const opening of floor.openings) {
      if (opening.connects) {
        reachable.add(opening.connects[0]);
        reachable.add(opening.connects[1]);
      }
      if (opening.kind === 'entrance') {
        const wall = floor.walls.find((w) => w.id === opening.wallId);
        wall?.rooms.forEach((id) => reachable.add(id));
      }
    }

    for (const room of floor.rooms) {
      expect(reachable.has(room.id)).toBe(true);
    }
  });

  it('places windows only on exterior walls', () => {
    const windows = floor.openings.filter((o) => o.kind === 'window');
    expect(windows.length).toBeGreaterThan(0);

    for (const window of windows) {
      const wall = floor.walls.find((w) => w.id === window.wallId);
      expect(wall?.exterior).toBe(true);
    }
  });

  it('the bathroom is not entered from a bedroom', () => {
    const typeOf = new Map(floor.rooms.map((r) => [r.id, r.roomType]));
    const doors = floor.openings.filter((o) => o.kind === 'door' && o.connects);

    for (const door of doors) {
      const [from, to] = door.connects!;
      if (typeOf.get(to) === 'bathroom') {
        expect(['corridor', 'living']).toContain(typeOf.get(from));
      }
    }
  });
});

describe('quality check', () => {
  it('a good plan passes validation', () => {
    const { house, adjacency } = build();
    const result = validateHouse(house, { ...OPTIONS, adjacency });

    expect(result.issues.filter((i) => i.severity === 'error')).toEqual([]);
    expect(result.ok).toBe(true);
    expect(result.score).toBeGreaterThan(80);
  });

  it('finds an error in a very small house', () => {
    const { house } = build(sampleTree(), { x: 0, y: 0, width: 6, length: 6 });
    const result = validateHouse(house, OPTIONS);

    expect(result.ok).toBe(false);
    expect(result.issues.some((i) => i.code === 'AREA_TOO_SMALL')).toBe(true);
  });

  it('catches a flat room', () => {
    const { house } = build(sampleTree(), { x: 0, y: 0, width: 40, length: 5 });
    const result = validateHouse(house, OPTIONS);

    expect(result.issues.some((i) => i.code === 'TOO_NARROW')).toBe(true);
  });
});

describe('moving a wall', () => {
  it('changes the ratio and keeps the area', () => {
    const after = moveSplit(sampleTree(), 's1', 0.7, BOUNDS, OPTIONS);
    const { house } = build(after);
    const total = house.floors[0].rooms.reduce((sum, r) => sum + r.area, 0);

    // Xona maydonlari ko'rsatish uchun 2 xonagacha yaxlitlanadi, shuning
    // uchun yig'indi bir necha sm² farq qilishi mumkin.
    expect(total).toBeCloseTo(BOUNDS.width * BOUNDS.length, 1);
  });

  it('never pushes a neighbour below the minimum area', () => {
    // 0.95 so'ralgan, lekin o'ng tomondagi 2 yotoqxona 9 m² dan kam bo'lolmaydi.
    const after = moveSplit(sampleTree(), 's1', 0.95, BOUNDS, OPTIONS);
    const { house } = build(after);

    for (const room of house.floors[0].rooms) {
      expect(room.area).toBeGreaterThanOrEqual(OPTIONS.rules[room.roomType].minArea - 0.01);
    }
  });
});

describe('measurements — the estimate comes from these', () => {
  const { house } = build();
  const m = measure(house);

  it('the floor area equals the bounds area', () => {
    expect(m.FLOOR_AREA).toBeCloseTo(BOUNDS.width * BOUNDS.length, 1);
  });

  it('computes the perimeter correctly', () => {
    expect(m.PERIMETER).toBe(2 * (BOUNDS.width + BOUNDS.length));
  });

  it('the wall area is positive and openings are subtracted', () => {
    expect(m.EXTERIOR_WALL_AREA).toBeGreaterThan(0);
    expect(m.INTERIOR_WALL_AREA).toBeGreaterThan(0);
    expect(m.WALL_AREA).toBeCloseTo(m.EXTERIOR_WALL_AREA + m.INTERIOR_WALL_AREA, 5);

    // Ochiqliksiz yuza — chegirmadan katta bo'lishi shart.
    const gross = m.PERIMETER * house.ceilingHeight;
    expect(m.EXTERIOR_WALL_AREA).toBeLessThan(gross);
  });

  it('a sloped roof is larger than its flat projection', () => {
    expect(m.ROOF_AREA).toBeGreaterThan(BOUNDS.width * BOUNDS.length);
  });

  it('counts doors and windows', () => {
    expect(m.WINDOW_COUNT).toBeGreaterThan(0);
    expect(m.DOOR_COUNT).toBeGreaterThan(0);
    expect(m.ROOM_COUNT).toBe(5);
    expect(m.FLOOR_COUNT).toBe(1);
  });

  it('the measurements grow with an added room', () => {
    const bigger = addRoom(sampleTree(), BOUNDS, 'bedroom', OPTIONS);
    const after = measure(build(bigger).house);

    expect(after.ROOM_COUNT).toBe(6);
    expect(after.INTERIOR_WALL_AREA).toBeGreaterThan(m.INTERIOR_WALL_AREA);
    expect(after.FLOOR_AREA).toBeCloseTo(m.FLOOR_AREA, 1);
  });
});

describe('multiple floors', () => {
  it('the stairs share one coordinate on every floor', () => {
    const tree = sampleTree();
    const stairs = pickStairs(tree, BOUNDS);

    const { house } = buildHouse(
      {
        bounds: BOUNDS,
        floors: [
          { level: 1, tree, stairs },
          { level: 2, tree: sampleTree(), stairs },
        ],
      },
      OPTIONS,
    );

    const result = validateHouse(house, OPTIONS);
    expect(result.issues.some((i) => i.code === 'STAIRS_MISALIGNED')).toBe(false);
    expect(house.floors).toHaveLength(2);
  });

  it('flags a multi-storey house with no stairs as an error', () => {
    const { house } = buildHouse(
      {
        bounds: BOUNDS,
        floors: [
          { level: 1, tree: sampleTree() },
          { level: 2, tree: sampleTree() },
        ],
      },
      OPTIONS,
    );

    const result = validateHouse(house, OPTIONS);
    expect(result.issues.some((i) => i.code === 'STAIRS_MISSING')).toBe(true);
  });
});
