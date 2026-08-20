import type { RoomTypeRow } from '@/types/room-type.types';
import type { RoomTypeRule } from '@/geometry/types';

function toRule(row: RoomTypeRow): RoomTypeRule {
  return {
    code: row.code,
    minArea: row.minArea,
    maxArea: row.maxArea,
    idealRatio: row.idealRatio,
    needsExteriorWall: row.needsExteriorWall,
    isWetZone: row.isWetZone,
    accessFrom: row.accessFrom,
    sunSides: (row.sunSides ?? []) as RoomTypeRule['sunSides'],
  };
}

export { toRule };
