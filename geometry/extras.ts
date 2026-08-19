import { round } from './tree';
import type { Extra, ExtraKind, Meters, Rect, WallSide } from './types';

interface KindSpec {
  width: Meters;
  depth: Meters;
  sides: WallSide[];
  floor: number;
  enclosed: boolean;
  detached?: boolean;
}

const GARAGE_CAR_WIDTH = 3.6;
const GARAGE_DEPTH = 6;
const DETACHED_GAP = 3;

const SPECS: Record<ExtraKind, KindSpec> = {
  garage: { width: GARAGE_CAR_WIDTH, depth: GARAGE_DEPTH, sides: ['west', 'east', 'south'], floor: 1, enclosed: true },
  terrace: { width: 6, depth: 3, sides: ['north', 'east', 'west'], floor: 1, enclosed: false },
  balcony: { width: 3.5, depth: 1.5, sides: ['south', 'east', 'west'], floor: 2, enclosed: false },
  sauna: { width: 3, depth: 4, sides: ['east', 'west', 'north'], floor: 1, enclosed: true },
  basement: { width: 0, depth: 0, sides: [], floor: 0, enclosed: true },
  pool: { width: 4, depth: 8, sides: ['north'], floor: 1, enclosed: false, detached: true },
};

export interface ExtraRequest {
  kind: ExtraKind;
  count?: number;
}

export interface PlaceExtrasInput {
  bounds: Rect;
  requests: ExtraRequest[];
  floors: number;
}

export interface PlaceExtrasResult {
  extras: Extra[];
  skipped: Array<{ kind: ExtraKind; reason: string }>;
  outerBounds: Rect;
}

export function placeExtras({ bounds, requests, floors }: PlaceExtrasInput): PlaceExtrasResult {
  const occupied: Record<WallSide, Array<[number, number]>> = {
    north: [],
    south: [],
    east: [],
    west: [],
  };

  const extras: Extra[] = [];
  const skipped: PlaceExtrasResult['skipped'] = [];
  let counter = 0;

  const ordered = [...requests].sort((first, second) => footprintOf(second) - footprintOf(first));

  for (const request of ordered) {
    const spec = SPECS[request.kind];
    if (!spec) continue;

    if (request.kind === 'basement') {
      extras.push({
        id: `x${++counter}`,
        kind: 'basement',
        rect: { ...bounds },
        floor: 0,
        side: null,
        enclosed: true,
        area: round(bounds.width * bounds.length),
      });
      continue;
    }

    if (spec.floor > floors) {
      skipped.push({ kind: request.kind, reason: `floor ${spec.floor} does not exist` });
      continue;
    }

    if (spec.detached) {
      extras.push({
        id: `x${++counter}`,
        kind: request.kind,
        rect: detachedRect(bounds, spec),
        floor: spec.floor,
        side: null,
        enclosed: spec.enclosed,
        area: round(spec.width * spec.depth),
      });
      continue;
    }

    const width = request.kind === 'garage' ? spec.width * Math.max(1, request.count ?? 1) : spec.width;
    const placement = findSlot(bounds, spec.sides, width, occupied);

    if (!placement) {
      skipped.push({ kind: request.kind, reason: 'devorlarda bo\'sh joy qolmadi' });
      continue;
    }

    occupied[placement.side].push([placement.start, placement.start + placement.width]);

    extras.push({
      id: `x${++counter}`,
      kind: request.kind,
      rect: attachedRect(bounds, placement.side, placement.start, placement.width, spec.depth),
      floor: spec.floor,
      side: placement.side,
      enclosed: spec.enclosed,
      area: round(placement.width * spec.depth),
    });
  }

  return { extras, skipped, outerBounds: envelope(bounds, extras) };
}

interface Placement {
  side: WallSide;
  start: number;
  width: number;
}

function findSlot(
  bounds: Rect,
  sides: WallSide[],
  wanted: number,
  occupied: Record<WallSide, Array<[number, number]>>,
): Placement | null {
  for (const side of sides) {
    const length = sideLength(bounds, side);
    const width = Math.min(wanted, length);
    if (width < 1) continue;

    const taken = [...occupied[side]].sort((first, second) => first[0] - second[0]);
    let cursor = 0;

    for (const [from, to] of taken) {
      if (from - cursor >= width) {
        return { side, start: round(cursor), width: round(width) };
      }
      cursor = Math.max(cursor, to);
    }

    if (length - cursor >= width) {
      return { side, start: round(cursor), width: round(width) };
    }
  }

  return null;
}

function sideLength(bounds: Rect, side: WallSide): number {
  return side === 'north' || side === 'south' ? bounds.width : bounds.length;
}

function attachedRect(
  bounds: Rect,
  side: WallSide,
  start: number,
  width: number,
  depth: number,
): Rect {
  switch (side) {
    case 'north':
      return { x: round(bounds.x + start), y: round(bounds.y - depth), width, length: depth };
    case 'south':
      return { x: round(bounds.x + start), y: round(bounds.y + bounds.length), width, length: depth };
    case 'west':
      return { x: round(bounds.x - depth), y: round(bounds.y + start), width: depth, length: width };
    case 'east':
      return { x: round(bounds.x + bounds.width), y: round(bounds.y + start), width: depth, length: width };
  }
}

function detachedRect(bounds: Rect, spec: KindSpec): Rect {
  return {
    x: round(bounds.x + (bounds.width - spec.width) / 2),
    y: round(bounds.y - DETACHED_GAP - spec.depth),
    width: spec.width,
    length: spec.depth,
  };
}

export function envelope(bounds: Rect, extras: Extra[]): Rect {
  let minX = bounds.x;
  let minY = bounds.y;
  let maxX = bounds.x + bounds.width;
  let maxY = bounds.y + bounds.length;

  for (const extra of extras) {
    minX = Math.min(minX, extra.rect.x);
    minY = Math.min(minY, extra.rect.y);
    maxX = Math.max(maxX, extra.rect.x + extra.rect.width);
    maxY = Math.max(maxY, extra.rect.y + extra.rect.length);
  }

  return {
    x: round(minX),
    y: round(minY),
    width: round(maxX - minX),
    length: round(maxY - minY),
  };
}

function footprintOf(request: ExtraRequest): number {
  const spec = SPECS[request.kind];
  if (!spec) return 0;
  if (request.kind === 'garage') return spec.width * Math.max(1, request.count ?? 1) * spec.depth;
  return spec.width * spec.depth;
}

export function requestsFrom(garageCars: number, extras: string[]): ExtraRequest[] {
  const requests: ExtraRequest[] = [];

  if (garageCars > 0) requests.push({ kind: 'garage', count: garageCars });

  for (const kind of extras) {
    if (kind in SPECS && kind !== 'garage') {
      requests.push({ kind: kind as ExtraKind });
    }
  }

  return requests;
}

export function areaByKind(extras: Extra[], kind: ExtraKind): number {
  return round(
    extras.filter((extra) => extra.kind === kind).reduce((sum, extra) => sum + extra.area, 0),
  );
}
