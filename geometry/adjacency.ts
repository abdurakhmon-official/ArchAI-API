import type { Rect, Room, Wall } from './types';
import { round } from './tree';

const EPS = 1e-6;

export interface Adjacency {
  neighbors: Map<string, string[]>;
  walls: Wall[];
}

interface Edge {
  position: number;
  from: number;
  to: number;
}

function overlap(a: Edge, b: Edge): number {
  return Math.min(a.to, b.to) - Math.max(a.from, b.from);
}

export function buildAdjacency(
  rooms: Room[],
  bounds: Rect,
  thickness: { exterior: number; interior: number },
): Adjacency {
  const neighbors = new Map<string, string[]>();
  const walls: Wall[] = [];
  let counter = 0;

  for (const room of rooms) neighbors.set(room.id, []);

  const link = (a: string, b: string) => {
    neighbors.get(a)!.push(b);
    neighbors.get(b)!.push(a);
  };

  for (let i = 0; i < rooms.length; i++) {
    for (let j = i + 1; j < rooms.length; j++) {
      const a = rooms[i];
      const b = rooms[j];

      const aRight = a.rect.x + a.rect.width;
      const bRight = b.rect.x + b.rect.width;
      const aBottom = a.rect.y + a.rect.length;
      const bBottom = b.rect.y + b.rect.length;

      const verticalTouch =
        Math.abs(aRight - b.rect.x) < EPS ? aRight : Math.abs(bRight - a.rect.x) < EPS ? bRight : null;

      if (verticalTouch !== null) {
        const span = overlap(
          { position: 0, from: a.rect.y, to: aBottom },
          { position: 0, from: b.rect.y, to: bBottom },
        );

        if (span > EPS) {
          const from = Math.max(a.rect.y, b.rect.y);
          walls.push({
            id: `w${++counter}`,
            from: { x: round(verticalTouch), y: round(from) },
            to: { x: round(verticalTouch), y: round(from + span) },
            exterior: false,
            rooms: [a.id, b.id],
            thickness: thickness.interior,
          });
          link(a.id, b.id);
          continue;
        }
      }

      const horizontalTouch =
        Math.abs(aBottom - b.rect.y) < EPS ? aBottom : Math.abs(bBottom - a.rect.y) < EPS ? bBottom : null;

      if (horizontalTouch !== null) {
        const span = overlap(
          { position: 0, from: a.rect.x, to: aRight },
          { position: 0, from: b.rect.x, to: bRight },
        );

        if (span > EPS) {
          const from = Math.max(a.rect.x, b.rect.x);
          walls.push({
            id: `w${++counter}`,
            from: { x: round(from), y: round(horizontalTouch) },
            to: { x: round(from + span), y: round(horizontalTouch) },
            exterior: false,
            rooms: [a.id, b.id],
            thickness: thickness.interior,
          });
          link(a.id, b.id);
        }
      }
    }
  }

  const right = bounds.x + bounds.width;
  const bottom = bounds.y + bounds.length;

  for (const room of rooms) {
    const r = room.rect;
    const rRight = r.x + r.width;
    const rBottom = r.y + r.length;

    if (Math.abs(r.x - bounds.x) < EPS) {
      walls.push(exteriorWall(`w${++counter}`, r.x, r.y, r.x, rBottom, room.id, thickness.exterior));
    }
    if (Math.abs(rRight - right) < EPS) {
      walls.push(exteriorWall(`w${++counter}`, rRight, r.y, rRight, rBottom, room.id, thickness.exterior));
    }
    if (Math.abs(r.y - bounds.y) < EPS) {
      walls.push(exteriorWall(`w${++counter}`, r.x, r.y, rRight, r.y, room.id, thickness.exterior));
    }
    if (Math.abs(rBottom - bottom) < EPS) {
      walls.push(exteriorWall(`w${++counter}`, r.x, rBottom, rRight, rBottom, room.id, thickness.exterior));
    }
  }

  return { neighbors, walls };
}

function exteriorWall(
  id: string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  roomId: string,
  thickness: number,
): Wall {
  return {
    id,
    from: { x: round(x1), y: round(y1) },
    to: { x: round(x2), y: round(y2) },
    exterior: true,
    rooms: [roomId],
    thickness,
  };
}

export function wallLength(wall: Wall): number {
  return Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y);
}

export function pathExists(
  adjacency: Adjacency,
  fromRoomId: string,
  isTarget: (roomId: string) => boolean,
  canPassThrough: (roomId: string) => boolean,
): boolean {
  const seen = new Set<string>([fromRoomId]);
  const queue = [fromRoomId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (current !== fromRoomId && isTarget(current)) return true;

    for (const next of adjacency.neighbors.get(current) ?? []) {
      if (seen.has(next)) continue;
      seen.add(next);
      if (isTarget(next)) return true;
      if (canPassThrough(next)) queue.push(next);
    }
  }

  return false;
}
