import { computeRects, computeRooms, countByType, depth, leaves, nextNodeId, splitRect } from '../tree';
import { BOUNDS, sampleTree } from './fixtures';

describe('split tree', () => {
  it('returns every leaf from left to right', () => {
    const ids = leaves(sampleTree()).map((leaf) => leaf.id);
    expect(ids).toEqual(['n1', 'n2', 'n3', 'n4', 'n5']);
  });

  it('computes the depth correctly', () => {
    expect(depth(sampleTree())).toBe(4);
  });

  it('counts by room type', () => {
    expect(countByType(sampleTree())).toEqual({
      living: 1,
      kitchen: 1,
      bathroom: 1,
      bedroom: 2,
    });
  });

  it('finds the next free identifier', () => {
    expect(nextNodeId(sampleTree())).toBe('n6');
    expect(nextNodeId(sampleTree(), 's')).toBe('s5');
  });

  describe('splitting a rectangle', () => {
    it('a vertical cut divides the width', () => {
      const [a, b] = splitRect({ x: 0, y: 0, width: 10, length: 8 }, 'vertical', 0.6);
      expect(a).toEqual({ x: 0, y: 0, width: 6, length: 8 });
      expect(b).toEqual({ x: 6, y: 0, width: 4, length: 8 });
    });

    it('a horizontal cut divides the length', () => {
      const [a, b] = splitRect({ x: 0, y: 0, width: 10, length: 8 }, 'horizontal', 0.25);
      expect(a).toEqual({ x: 0, y: 0, width: 10, length: 2 });
      expect(b).toEqual({ x: 0, y: 2, width: 10, length: 6 });
    });
  });

  describe('guarantee: no overlaps and no gaps', () => {
    const rooms = computeRooms(sampleTree(), BOUNDS);

    it('the room areas equal the bounds area', () => {
      const total = rooms.reduce((sum, room) => sum + room.area, 0);
      expect(total).toBeCloseTo(BOUNDS.width * BOUNDS.length, 5);
    });

    it('no pair overlaps', () => {
      for (let i = 0; i < rooms.length; i++) {
        for (let j = i + 1; j < rooms.length; j++) {
          const a = rooms[i].rect;
          const b = rooms[j].rect;
          const overlapX = Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x);
          const overlapY = Math.min(a.y + a.length, b.y + b.length) - Math.max(a.y, b.y);
          expect(Math.min(overlapX, overlapY)).toBeLessThanOrEqual(1e-9);
        }
      }
    });

    it('every room stays inside the bounds', () => {
      for (const room of rooms) {
        expect(room.rect.x).toBeGreaterThanOrEqual(BOUNDS.x - 1e-9);
        expect(room.rect.y).toBeGreaterThanOrEqual(BOUNDS.y - 1e-9);
        expect(room.rect.x + room.rect.width).toBeLessThanOrEqual(BOUNDS.x + BOUNDS.width + 1e-9);
        expect(room.rect.y + room.rect.length).toBeLessThanOrEqual(BOUNDS.y + BOUNDS.length + 1e-9);
      }
    });
  });

  it('proportions survive a change of bounds', () => {
    const small = computeRooms(sampleTree(), BOUNDS);
    const large = computeRooms(sampleTree(), { x: 0, y: 0, width: 24, length: 30 });

    // O'lchamlar 2 barobar → maydon 4 barobar, nisbat o'zgarmaydi.
    small.forEach((room, index) => {
      expect(large[index].area).toBeCloseTo(room.area * 4, 4);
      expect(large[index].ratio).toBeCloseTo(room.ratio, 4);
    });
  });

  it('a rectangle is computed for every node', () => {
    const rects = computeRects(sampleTree(), BOUNDS);
    expect(rects.get('s1')).toEqual(BOUNDS);
    expect(rects.size).toBe(9); // 5 barg + 4 kesim
  });
});
