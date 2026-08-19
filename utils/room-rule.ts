import type { RoomTypeRow } from '@/types/room-type.types';
import type { RoomTypeRule } from '@/geometry/types';

function toRule(row: RoomTypeRow): RoomTypeRule {
  return {
    code: row.code,
    minArea: row.min_area,
    maxArea: row.max_area,
    idealRatio: row.ideal_ratio,
    needsExteriorWall: row.needs_exterior_wall,
    isWetZone: row.is_wet_zone,
    accessFrom: row.access_from,
    sunSides: (row.sun_sides ?? []) as RoomTypeRule['sunSides'],
  };
}

export { toRule };
