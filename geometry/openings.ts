import { wallLength, type Adjacency } from './adjacency';
import { round } from './tree';
import {
  DOOR_HEIGHT,
  DOOR_WIDTH,
  ENTRANCE_WIDTH,
  type LayoutRules,
  type Opening,
  type Room,
  type RoomTypeRule,
  type Wall,
} from './types';

const WINDOW_HEIGHT = 1.5;
const WINDOW_SILL_GAP = 0.6;

export interface OpeningOptions {
  rules: Record<string, RoomTypeRule>;
  layout: LayoutRules;
}

export function pickEntryRoom(rooms: Room[], walls: Wall[]): Room | null {
  const exteriorRooms = new Set(walls.filter((w) => w.exterior).flatMap((w) => w.rooms));

  const corridor = rooms.find((r) => r.roomType === 'corridor' && exteriorRooms.has(r.id));
  if (corridor) return corridor;

  const hall = rooms.find((r) => r.roomType === 'hall' && exteriorRooms.has(r.id));
  if (hall) return hall;

  const candidates = rooms
    .filter((r) => exteriorRooms.has(r.id) && r.roomType !== 'bathroom')
    .sort((a, b) => b.area - a.area);

  return candidates[0] ?? rooms[0] ?? null;
}

export function placeDoors(
  rooms: Room[],
  walls: Wall[],
  adjacency: Adjacency,
  entryRoomId: string,
  options: OpeningOptions,
): Opening[] {
  const byId = new Map(rooms.map((r) => [r.id, r]));
  const interior = walls.filter((w) => !w.exterior);

  const wallBetween = (a: string, b: string): Wall | undefined =>
    interior.find((w) => w.rooms.includes(a) && w.rooms.includes(b));

  const openings: Opening[] = [];
  const visited = new Set<string>([entryRoomId]);
  let counter = 0;

  const allowedFrom = (fromType: string, toType: string): boolean => {
    const rule = options.rules[toType];
    if (!rule || rule.accessFrom.length === 0) return true;
    return rule.accessFrom.includes(fromType);
  };

  let progress = true;
  while (progress) {
    progress = false;

    for (const roomId of [...visited]) {
      const fromType = byId.get(roomId)?.roomType ?? '';

      for (const neighborId of adjacency.neighbors.get(roomId) ?? []) {
        if (visited.has(neighborId)) continue;

        const toType = byId.get(neighborId)?.roomType ?? '';
        if (!allowedFrom(fromType, toType)) continue;

        const wall = wallBetween(roomId, neighborId);
        if (!wall) continue;

        const length = wallLength(wall);
        if (length < DOOR_WIDTH + 0.2) continue;

        openings.push({
          id: `d${++counter}`,
          kind: 'door',
          wallId: wall.id,
          offset: round(length / 2),
          width: DOOR_WIDTH,
          height: DOOR_HEIGHT,
          connects: [roomId, neighborId],
        });

        visited.add(neighborId);
        progress = true;
      }
    }
  }

  for (const room of rooms) {
    if (visited.has(room.id)) continue;

    for (const neighborId of adjacency.neighbors.get(room.id) ?? []) {
      if (!visited.has(neighborId)) continue;

      const wall = wallBetween(room.id, neighborId);
      if (!wall || wallLength(wall) < DOOR_WIDTH + 0.2) continue;

      openings.push({
        id: `d${++counter}`,
        kind: 'door',
        wallId: wall.id,
        offset: round(wallLength(wall) / 2),
        width: DOOR_WIDTH,
        height: DOOR_HEIGHT,
        connects: [neighborId, room.id],
      });

      visited.add(room.id);
      break;
    }
  }

  return openings;
}

export function placeEntrance(walls: Wall[], entryRoomId: string): Opening | null {
  const candidates = walls
    .filter((w) => w.exterior && w.rooms.includes(entryRoomId))
    .sort((a, b) => wallLength(b) - wallLength(a));

  const wall = candidates[0];
  if (!wall || wallLength(wall) < ENTRANCE_WIDTH + 0.4) return null;

  return {
    id: 'e1',
    kind: 'entrance',
    wallId: wall.id,
    offset: round(wallLength(wall) / 2),
    width: ENTRANCE_WIDTH,
    height: DOOR_HEIGHT,
  };
}

export function placeWindows(
  rooms: Room[],
  walls: Wall[],
  options: OpeningOptions,
  taken: Opening[] = [],
): Opening[] {
  const takenByWall = new Set(taken.map((o) => o.wallId));
  const openings: Opening[] = [];
  let counter = 0;

  for (const room of rooms) {
    const rule = options.rules[room.roomType];
    if (rule && !rule.needsExteriorWall && rule.isWetZone) continue;
    if (room.roomType === 'corridor') continue;

    const exteriorWalls = walls
      .filter((w) => w.exterior && w.rooms.includes(room.id))
      .sort((a, b) => wallLength(b) - wallLength(a));

    if (exteriorWalls.length === 0) continue;

    const wantedArea = room.area * options.layout.windowWallAreaRatio;
    let remaining = wantedArea;

    for (const wall of exteriorWalls) {
      if (remaining <= 0.2) break;

      const usable = wallLength(wall) - WINDOW_SILL_GAP * 2 - (takenByWall.has(wall.id) ? ENTRANCE_WIDTH : 0);
      if (usable < 0.6) continue;

      const width = Math.min(usable, remaining / WINDOW_HEIGHT);
      if (width < 0.6) continue;

      openings.push({
        id: `v${++counter}_${room.id}`,
        kind: 'window',
        wallId: wall.id,
        offset: round(wallLength(wall) / 2),
        width: round(width),
        height: WINDOW_HEIGHT,
      });

      remaining -= width * WINDOW_HEIGHT;
    }
  }

  return openings;
}
