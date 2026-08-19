import type { Adjacency } from './adjacency';
import type { Floor, House, Issue, RoomTypeRule, ValidationResult } from './types';

const MAX_RATIO = 3;

export function maxRatioFor(rule?: RoomTypeRule): number {
  if (!rule) return MAX_RATIO;
  return Math.max(MAX_RATIO, rule.idealRatio * 2);
}
const WET_ZONE_DISTANCE = 8;

export interface ValidateOptions {
  rules: Record<string, RoomTypeRule>;
  minAreaFactor?: number;
  adjacency?: Map<number, Adjacency>;
}

export function validateHouse(house: House, options: ValidateOptions): ValidationResult {
  const issues: Issue[] = [];

  for (const floor of house.floors) {
    issues.push(...validateFloor(floor, options));
  }

  issues.push(...validateStairs(house));

  const score = scoreOf(issues);
  return {
    ok: !issues.some((issue) => issue.severity === 'error'),
    issues,
    score,
  };
}

export function validateFloor(floor: Floor, options: ValidateOptions): Issue[] {
  const issues: Issue[] = [];
  const factor = options.minAreaFactor ?? 1;

  const roomsWithDoor = new Set<string>();
  for (const opening of floor.openings) {
    if (opening.connects) {
      roomsWithDoor.add(opening.connects[0]);
      roomsWithDoor.add(opening.connects[1]);
    }
  }

  const roomsWithWindow = new Set(
    floor.openings
      .filter((o) => o.kind === 'window')
      .flatMap((o) => floor.walls.find((w) => w.id === o.wallId)?.rooms ?? []),
  );

  const entryRooms = new Set(
    floor.openings
      .filter((o) => o.kind === 'entrance')
      .flatMap((o) => floor.walls.find((w) => w.id === o.wallId)?.rooms ?? []),
  );

  for (const room of floor.rooms) {
    const rule = options.rules[room.roomType];

    if (rule) {
      const min = rule.minArea * factor;
      if (room.area < min) {
        issues.push({
          code: 'AREA_TOO_SMALL',
          severity: 'error',
          roomId: room.id,
          floor: floor.level,
          message: `${room.roomType}: ${room.area} m² is below the ${min.toFixed(1)} m² minimum`,
          values: { room: room.roomType, area: room.area, min: min.toFixed(1) },
        });
      } else if (room.area > rule.maxArea * 1.6) {
        issues.push({
          code: 'AREA_TOO_LARGE',
          severity: 'warning',
          roomId: room.id,
          floor: floor.level,
          message: `${room.roomType}: ${room.area} m² is unusually large`,
          values: { room: room.roomType, area: room.area },
        });
      }

      if (rule.needsExteriorWall && !roomsWithWindow.has(room.id)) {
        issues.push({
          code: 'NO_WINDOW',
          severity: 'error',
          roomId: room.id,
          floor: floor.level,
          message: `${room.roomType}: a living room without a window`,
          values: { room: room.roomType },
        });
      }
    }

    const maxRatio = maxRatioFor(rule);
    if (room.ratio > maxRatio) {
      issues.push({
        code: 'TOO_NARROW',
        severity: 'error',
        roomId: room.id,
        floor: floor.level,
        message: `${room.roomType}: ratio 1:${room.ratio.toFixed(1)}, the limit is 1:${maxRatio.toFixed(1)}`,
        values: { room: room.roomType, ratio: room.ratio.toFixed(1), max: maxRatio.toFixed(1) },
      });
    }

    const reachable = roomsWithDoor.has(room.id) || entryRooms.has(room.id);
    if (!reachable && floor.rooms.length > 1) {
      issues.push({
        code: 'NO_ACCESS',
        severity: 'error',
        roomId: room.id,
        floor: floor.level,
        message: `${room.roomType}: has no door, it cannot be entered`,
        values: { room: room.roomType },
      });
    }
  }

  issues.push(...validateAccessSources(floor, options));
  issues.push(...validateWetZones(floor));

  return issues;
}

function validateAccessSources(floor: Floor, options: ValidateOptions): Issue[] {
  const issues: Issue[] = [];
  const typeOf = new Map(floor.rooms.map((r) => [r.id, r.roomType]));

  for (const opening of floor.openings) {
    if (opening.kind !== 'door' || !opening.connects) continue;

    const [fromId, toId] = opening.connects;
    const fromType = typeOf.get(fromId);
    const toType = typeOf.get(toId);
    if (!fromType || !toType) continue;

    const rule = options.rules[toType];
    if (!rule || rule.accessFrom.length === 0) continue;
    if (rule.accessFrom.includes(fromType)) continue;

    issues.push({
      code: 'INVALID_ACCESS_SOURCE',
      severity: 'warning',
      roomId: toId,
      floor: floor.level,
      message: `${toType} is entered through ${fromType}, expected: ${rule.accessFrom.join(', ')}`,
      values: { room: toType, through: fromType, expected: rule.accessFrom.join(', ') },
    });
  }

  return issues;
}

function validateWetZones(floor: Floor): Issue[] {
  const wet = floor.rooms.filter((r) => r.roomType === 'bathroom' || r.roomType === 'kitchen');
  if (wet.length < 2) return [];

  const center = (r: (typeof wet)[number]) => ({
    x: r.rect.x + r.rect.width / 2,
    y: r.rect.y + r.rect.length / 2,
  });

  let worst = 0;
  for (let i = 0; i < wet.length; i++) {
    for (let j = i + 1; j < wet.length; j++) {
      const a = center(wet[i]);
      const b = center(wet[j]);
      worst = Math.max(worst, Math.hypot(a.x - b.x, a.y - b.y));
    }
  }

  if (worst <= WET_ZONE_DISTANCE) return [];

  return [
    {
      code: 'WET_ZONE_SCATTERED',
      severity: 'warning',
      floor: floor.level,
      message: `wet rooms are ${worst.toFixed(1)} m apart, which lengthens the plumbing`,
      values: { distance: worst.toFixed(1) },
    },
  ];
}

function validateStairs(house: House): Issue[] {
  if (house.floors.length < 2) return [];

  const withStairs = house.floors.filter((f) => f.stairs);
  if (withStairs.length < house.floors.length) {
    return [
      {
        code: 'STAIRS_MISSING',
        severity: 'error',
        message: 'a multi-storey house needs stairs on every floor',
      },
    ];
  }

  const first = withStairs[0].stairs!;
  for (const floor of withStairs.slice(1)) {
    const s = floor.stairs!;
    if (Math.abs(s.x - first.x) > 0.1 || Math.abs(s.y - first.y) > 0.1) {
      return [
        {
          code: 'STAIRS_MISALIGNED',
          severity: 'error',
          floor: floor.level,
          message: 'the stairs do not line up between floors',
        },
      ];
    }
  }

  return [];
}

function scoreOf(issues: Issue[]): number {
  let score = 100;
  for (const issue of issues) {
    score -= issue.severity === 'error' ? 25 : 6;
  }
  return Math.max(0, score);
}
