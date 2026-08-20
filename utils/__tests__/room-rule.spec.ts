import { toRule } from '../room-rule';
import type { RoomTypeRow } from '@/types/room-type.types';

/**
 * `toRule` prepares catalogue rows for the geometry generator. A wrong
 * field mapping here silently produces a broken house plan — no error,
 * just a room that violates its own rule.
 */

const row = (over: Partial<RoomTypeRow> = {}): RoomTypeRow => ({
  code: 'bedroom',
  minArea: 8,
  maxArea: 20,
  idealRatio: 1.2,
  needsExteriorWall: true,
  isWetZone: false,
  accessFrom: ['corridor'],
  ...over,
});

describe('toRule', () => {
  it('maps catalogue columns to the geometry rule shape', () => {
    expect(toRule(row())).toEqual({
      code: 'bedroom',
      minArea: 8,
      maxArea: 20,
      idealRatio: 1.2,
      needsExteriorWall: true,
      isWetZone: false,
      accessFrom: ['corridor'],
      sunSides: [],
    });
  });

  it('passes through explicit sun sides', () => {
    expect(toRule(row({ sunSides: ['south', 'east'] })).sunSides).toEqual(['south', 'east']);
  });

  it('defaults sun sides to an empty array when absent', () => {
    expect(toRule(row({ sunSides: undefined })).sunSides).toEqual([]);
  });
});
