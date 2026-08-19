import { wallLength } from './adjacency';
import { areaByKind } from './extras';
import { buildRoof, eaveHeightFor } from './roof';
import { round } from './tree';
import type { House, Measurements } from './types';

export const MEASURE_KEYS = [
  'PERIMETER',
  'FLOOR_AREA',
  'EXTERIOR_WALL_AREA',
  'INTERIOR_WALL_AREA',
  'WALL_AREA',
  'ROOF_AREA',
  'FOUNDATION_VOLUME',
  'CEILING_AREA',
  'WINDOW_COUNT',
  'DOOR_COUNT',
  'WINDOW_AREA',
  'FLOOR_COUNT',
  'ROOM_COUNT',
  'GARAGE_AREA',
  'TERRACE_AREA',
  'BALCONY_AREA',
  'BASEMENT_AREA',
  'SAUNA_AREA',
  'POOL_AREA',
] as const satisfies readonly (keyof Measurements)[];

export type MeasureKey = (typeof MEASURE_KEYS)[number];

type MissingFromList = Exclude<keyof Measurements, MeasureKey>;
const _allKeysListed: MissingFromList extends never ? true : MissingFromList = true;
void _allKeysListed;

export function isMeasureKey(value: string): value is MeasureKey {
  return (MEASURE_KEYS as readonly string[]).includes(value);
}

const FOUNDATION_DEPTH = 1.0;
const FOUNDATION_WIDTH = 0.4;
const SLAB_THICKNESS = 0.25;

export function measure(house: House): Measurements {
  const { bounds, floors, roof, ceilingHeight, extras } = house;

  const perimeter = 2 * (bounds.width + bounds.length);

  let floorArea = 0;
  let exteriorWallArea = 0;
  let interiorWallArea = 0;
  let windowCount = 0;
  let windowArea = 0;
  let doorCount = 0;
  let doorArea = 0;
  let roomCount = 0;

  for (const floor of floors) {
    for (const room of floor.rooms) {
      floorArea += room.area;
      roomCount += 1;
    }

    const openingsByWall = new Map<string, number>();
    for (const opening of floor.openings) {
      const area = opening.width * opening.height;
      openingsByWall.set(opening.wallId, (openingsByWall.get(opening.wallId) ?? 0) + area);

      if (opening.kind === 'window') {
        windowCount += 1;
        windowArea += area;
      } else {
        doorCount += 1;
        doorArea += area;
      }
    }

    for (const wall of floor.walls) {
      const gross = wallLength(wall) * ceilingHeight;
      const net = Math.max(0, gross - (openingsByWall.get(wall.id) ?? 0));
      if (wall.exterior) exteriorWallArea += net;
      else interiorWallArea += net;
    }
  }

  const roofGeometry = buildRoof({
    bounds,
    spec: roof,
    eaveHeight: eaveHeightFor(floors.length, ceilingHeight, SLAB_THICKNESS),
  });

  return {
    PERIMETER: round(perimeter),
    FLOOR_AREA: round(floorArea),
    EXTERIOR_WALL_AREA: round(exteriorWallArea),
    INTERIOR_WALL_AREA: round(interiorWallArea),
    WALL_AREA: round(exteriorWallArea + interiorWallArea),
    ROOF_AREA: round(roofGeometry.totalArea),
    FOUNDATION_VOLUME: round(perimeter * FOUNDATION_DEPTH * FOUNDATION_WIDTH),
    CEILING_AREA: round(floorArea),
    WINDOW_COUNT: windowCount,
    DOOR_COUNT: doorCount,
    WINDOW_AREA: round(windowArea),
    FLOOR_COUNT: floors.length,
    ROOM_COUNT: roomCount,

    GARAGE_AREA: areaByKind(extras, 'garage'),
    TERRACE_AREA: areaByKind(extras, 'terrace'),
    BALCONY_AREA: areaByKind(extras, 'balcony'),
    BASEMENT_AREA: areaByKind(extras, 'basement'),
    SAUNA_AREA: areaByKind(extras, 'sauna'),
    POOL_AREA: areaByKind(extras, 'pool'),
  };
}

export function measureRoom(house: House, roomId: string): { floor: number; wall: number; ceiling: number } | null {
  for (const floor of house.floors) {
    const room = floor.rooms.find((candidate) => candidate.id === roomId);
    if (!room) continue;

    const perimeter = 2 * (room.rect.width + room.rect.length);
    const openings = floor.openings.filter((opening) => {
      const wall = floor.walls.find((candidate) => candidate.id === opening.wallId);
      return wall?.rooms.includes(roomId);
    });

    const openingArea = openings.reduce((sum, opening) => sum + opening.width * opening.height, 0);

    return {
      floor: room.area,
      wall: round(Math.max(0, perimeter * house.ceilingHeight - openingArea)),
      ceiling: room.area,
    };
  }

  return null;
}
