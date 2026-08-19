import { edgesOf, orientationOf, toCompass } from '@/geometry/orientation';
import type { House, Rect, Room, RoomTypeRule } from '@/geometry/types';

/**
 * Yo'nalish va quyosh qoidasi.
 *
 * Reja chizmasining yuqori cheti har doim shimol emas — uchastka
 * ixtiyoriy tomonga qaragan bo'lishi mumkin.
 */

const BOUNDS: Rect = { x: 0, y: 0, width: 10, length: 10 };

const RULES: Record<string, RoomTypeRule> = {
  bedroom: { code: 'bedroom', minArea: 9, maxArea: 25, idealRatio: 1.3, needsExteriorWall: true, isWetZone: false, accessFrom: [], sunSides: ['east'] },
  living: { code: 'living', minArea: 16, maxArea: 45, idealRatio: 1.5, needsExteriorWall: true, isWetZone: false, accessFrom: [], sunSides: ['south'] },
  corridor: { code: 'corridor', minArea: 2, maxArea: 20, idealRatio: 3, needsExteriorWall: false, isWetZone: false, accessFrom: [] },
};

const room = (id: string, roomType: string, rect: Rect): Room => ({
  id,
  roomType,
  rect,
  area: rect.width * rect.length,
  ratio: Math.max(rect.width, rect.length) / Math.min(rect.width, rect.length),
});

const houseOf = (rooms: Room[]): House =>
  ({ bounds: BOUNDS, floors: [{ level: 1, rooms }] }) as unknown as House;

describe('from a drawing edge to a compass side', () => {
  it('nothing changes when north is up', () => {
    expect(toCompass('north', 'north')).toBe('north');
    expect(toCompass('east', 'north')).toBe('east');
  });

  it('the sides turn with the drawing', () => {
    // Chizmaning o'ng cheti shimolga qaraydi.
    expect(toCompass('east', 'east')).toBe('north');
    expect(toCompass('north', 'east')).toBe('west');
    expect(toCompass('south', 'east')).toBe('east');
  });

  it('a full turn comes back to itself', () => {
    for (const side of ['north', 'east', 'south', 'west'] as const) {
      expect(toCompass(side, 'north')).toBe(side);
    }
  });
});

describe('which edge a room touches', () => {
  it('a corner room touches two edges', () => {
    const corner = room('r1', 'bedroom', { x: 0, y: 0, width: 4, length: 4 });
    expect(edgesOf(corner, BOUNDS).sort()).toEqual(['north', 'west']);
  });

  it('an inner room touches no edge', () => {
    const inner = room('r2', 'bedroom', { x: 3, y: 3, width: 4, length: 4 });
    expect(edgesOf(inner, BOUNDS)).toEqual([]);
  });

  it('bottom right corner', () => {
    const corner = room('r3', 'bedroom', { x: 6, y: 6, width: 4, length: 4 });
    expect(edgesOf(corner, BOUNDS).sort()).toEqual(['east', 'south']);
  });
});

describe('orientation score', () => {
  it('100 when everything is in place', () => {
    const house = houseOf([
      room('r1', 'bedroom', { x: 6, y: 2, width: 4, length: 4 }),
      room('r2', 'living', { x: 2, y: 6, width: 4, length: 4 }),
    ]);

    expect(orientationOf(house, 'north', RULES).score).toBe(100);
  });

  it('0 when it is the other way round', () => {
    // Yotoqxona g'arbda, mehmonxona shimolda.
    const house = houseOf([
      room('r1', 'bedroom', { x: 0, y: 2, width: 4, length: 4 }),
      room('r2', 'living', { x: 2, y: 0, width: 4, length: 4 }),
    ]);

    expect(orientationOf(house, 'north', RULES).score).toBe(0);
  });

  it('the score changes with the drawing', () => {
    /*
      Aynan shu narsa muhim: bir xil reja uchastka boshqa tomonga
      qaraganda boshqa ball olishi kerak. Aks holda yo'nalishni
      so'rashning ma'nosi yo'q.
    */
    const house = houseOf([room('r1', 'bedroom', { x: 6, y: 2, width: 4, length: 4 })]);

    expect(orientationOf(house, 'north', RULES).score).toBe(100);
    expect(orientationOf(house, 'east', RULES).score).toBe(0);
  });

  it('a room with no preference is not counted', () => {
    // Koridorda `sunSides` yo'q — u ballga ta'sir qilmasligi kerak.
    const house = houseOf([
      room('r1', 'bedroom', { x: 6, y: 2, width: 4, length: 4 }),
      room('r2', 'corridor', { x: 0, y: 0, width: 2, length: 10 }),
    ]);

    const result = orientationOf(house, 'north', RULES);
    expect(result.notes).toHaveLength(1);
    expect(result.score).toBe(100);
  });

  it('an inner room is not counted either', () => {
    const house = houseOf([
      room('r1', 'bedroom', { x: 6, y: 2, width: 4, length: 4 }),
      room('r2', 'living', { x: 3, y: 3, width: 3, length: 3 }),
    ]);

    const result = orientationOf(house, 'north', RULES);
    expect(result.notes.map((note) => note.roomId)).toEqual(['r1']);
  });

  it('returns 100 when there is no room to judge', () => {
    const house = houseOf([room('r1', 'corridor', { x: 0, y: 0, width: 2, length: 10 })]);
    expect(orientationOf(house, 'north', RULES)).toEqual({ score: 100, notes: [] });
  });
});
