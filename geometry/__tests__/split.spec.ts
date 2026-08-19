import { addRoom, changeRoomType, GeometryError, mergeLeaves, removeRoom, splitLeaf } from '../split';
import { computeRooms, countByType, leaves } from '../tree';
import type { TreeNode } from '../types';
import { BOUNDS, OPTIONS, sampleTree } from './fixtures';

const totalArea = (tree: Parameters<typeof computeRooms>[0]) =>
  computeRooms(tree, BOUNDS).reduce((sum, room) => sum + room.area, 0);

describe('adding a room', () => {
  it('splits a leaf in two and adds one room', () => {
    const before = sampleTree();
    const after = addRoom(before, BOUNDS, 'bedroom', OPTIONS);

    expect(leaves(after)).toHaveLength(leaves(before).length + 1);
    expect(countByType(after).bedroom).toBe(3);
  });

  it('keeps the total area — no gap appears', () => {
    const after = addRoom(sampleTree(), BOUNDS, 'bathroom', OPTIONS);
    expect(totalArea(after)).toBeCloseTo(BOUNDS.width * BOUNDS.length, 5);
  });

  it('leaves the original tree untouched', () => {
    const before = sampleTree();
    addRoom(before, BOUNDS, 'bedroom', OPTIONS);
    expect(leaves(before)).toHaveLength(5);
  });

  it('both parts stay above the minimum area', () => {
    const after = addRoom(sampleTree(), BOUNDS, 'bedroom', OPTIONS);

    for (const room of computeRooms(after, BOUNDS)) {
      const min = OPTIONS.rules[room.roomType].minArea;
      expect(room.area).toBeGreaterThanOrEqual(min);
    }
  });

  it('gives a clear error when there is not enough room', () => {
    const tiny = { x: 0, y: 0, width: 3, length: 3 };
    const tree = { kind: 'leaf' as const, id: 'n1', roomType: 'bathroom' };

    expect(() => addRoom(tree, tiny, 'living', OPTIONS)).toThrow(GeometryError);
    expect(() => addRoom(tree, tiny, 'living', OPTIONS)).toThrow(/no room has enough space/);
  });

  it('cuts a corridor only as a last resort', () => {
    const tree: TreeNode = {
      kind: 'split',
      id: 's1',
      axis: 'vertical',
      ratio: 0.5,
      children: [
        { kind: 'leaf', id: 'n1', roomType: 'corridor' },
        { kind: 'leaf', id: 'n2', roomType: 'living' },
      ],
    };

    const after = addRoom(tree, BOUNDS, 'bedroom', OPTIONS);
    const corridor = leaves(after).filter((leaf) => leaf.roomType === 'corridor');

    // Koridor bo'linmagan — kesim mehmonxonada bo'lgan.
    expect(corridor).toHaveLength(1);
  });
});

describe('removing a room', () => {
  it('drops the room count by one', () => {
    const after = removeRoom(sampleTree(), 'n3');
    expect(leaves(after)).toHaveLength(4);
    expect(leaves(after).map((l) => l.id)).not.toContain('n3');
  });

  it('hands the space to the neighbour — the area is kept', () => {
    const after = removeRoom(sampleTree(), 'n3');
    expect(totalArea(after)).toBeCloseTo(BOUNDS.width * BOUNDS.length, 5);
  });

  it('the neighbour gains area', () => {
    const kitchenBefore = computeRooms(sampleTree(), BOUNDS).find((r) => r.id === 'n2')!;
    const after = removeRoom(sampleTree(), 'n3');
    const kitchenAfter = computeRooms(after, BOUNDS).find((r) => r.id === 'n2')!;

    expect(kitchenAfter.area).toBeGreaterThan(kitchenBefore.area);
  });

  it('refuses to delete the last room', () => {
    const single = { kind: 'leaf' as const, id: 'n1', roomType: 'living' };
    expect(() => removeRoom(single, 'n1')).toThrow(/cannot remove the only room/);
  });

  it('errors for a room that does not exist', () => {
    expect(() => removeRoom(sampleTree(), 'yoq')).toThrow(GeometryError);
  });
});

describe('adding and removing are inverse operations', () => {
  it('adding then removing restores the room count', () => {
    const before = sampleTree();
    const added = addRoom(before, BOUNDS, 'bedroom', OPTIONS);
    const newLeaf = leaves(added).find((leaf) => !leaves(before).some((l) => l.id === leaf.id))!;
    const removed = removeRoom(added, newLeaf.id);

    expect(leaves(removed)).toHaveLength(leaves(before).length);
    expect(countByType(removed)).toEqual(countByType(before));
  });
});

describe('other operations', () => {
  it('splitting a named leaf', () => {
    const after = splitLeaf(sampleTree(), 'n1', 'bedroom', BOUNDS, OPTIONS);
    expect(countByType(after).bedroom).toBe(3);
    expect(countByType(after).living).toBe(1);
  });

  it('merging two neighbouring leaves', () => {
    const after = mergeLeaves(sampleTree(), 's3');
    expect(leaves(after)).toHaveLength(4);
    expect(countByType(after).bathroom).toBeUndefined();
  });

  it('swapping the room type leaves the geometry alone', () => {
    const before = computeRooms(sampleTree(), BOUNDS);
    const after = changeRoomType(sampleTree(), 'n4', 'living');
    const rooms = computeRooms(after, BOUNDS);

    expect(rooms.find((r) => r.id === 'n4')!.roomType).toBe('living');
    expect(rooms.map((r) => r.area)).toEqual(before.map((r) => r.area));
  });
});
