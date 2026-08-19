import { buildAdjacency, type Adjacency } from './adjacency';
import { placeExtras, type ExtraRequest } from './extras';
import { placeDoors, pickEntryRoom, placeEntrance, placeWindows } from './openings';
import { computeRooms } from './tree';
import {
  DEFAULT_LAYOUT_RULES,
  DEFAULT_WALL_THICKNESS,
  type Floor,
  type House,
  type LayoutRules,
  type Rect,
  type RoofSpec,
  type RoomTypeRule,
  type Stairs,
  type TreeNode,
} from './types';

export interface BuildOptions {
  rules: Record<string, RoomTypeRule>;
  layout?: Partial<LayoutRules>;
  wallThickness?: { exterior: number; interior: number };
}

export interface FloorSpec {
  level: number;
  tree: TreeNode;
  stairs?: Stairs;
}

export interface BuiltFloor {
  floor: Floor;
  adjacency: Adjacency;
}

export function buildFloor(
  spec: FloorSpec,
  bounds: Rect,
  options: BuildOptions,
): BuiltFloor {
  const layout: LayoutRules = { ...DEFAULT_LAYOUT_RULES, ...options.layout };
  const thickness = options.wallThickness ?? DEFAULT_WALL_THICKNESS;

  const rooms = computeRooms(spec.tree, bounds);
  const adjacency = buildAdjacency(rooms, bounds, thickness);
  const walls = adjacency.walls;

  const entryRoom = pickEntryRoom(rooms, walls);
  const openingOptions = { rules: options.rules, layout };

  const openings = [];

  if (spec.level === 1 && entryRoom) {
    const entrance = placeEntrance(walls, entryRoom.id);
    if (entrance) openings.push(entrance);
  }

  if (entryRoom) {
    openings.push(...placeDoors(rooms, walls, adjacency, entryRoom.id, openingOptions));
  }

  openings.push(...placeWindows(rooms, walls, openingOptions, openings));

  return {
    floor: {
      level: spec.level,
      bounds,
      tree: spec.tree,
      rooms,
      walls,
      openings,
      stairs: spec.stairs,
      entrySide: spec.level === 1 ? 'south' : undefined,
    },
    adjacency,
  };
}

export interface BuildHouseInput {
  bounds: Rect;
  floors: FloorSpec[];
  roof?: Partial<RoofSpec>;
  extras?: ExtraRequest[];
}

export function buildHouse(
  input: BuildHouseInput,
  options: BuildOptions,
): {
  house: House;
  adjacency: Map<number, Adjacency>;
  skippedExtras: Array<{ kind: string; reason: string }>;
} {
  const layout: LayoutRules = { ...DEFAULT_LAYOUT_RULES, ...options.layout };
  const thickness = options.wallThickness ?? DEFAULT_WALL_THICKNESS;

  const floors: Floor[] = [];
  const adjacency = new Map<number, Adjacency>();

  for (const spec of input.floors) {
    const built = buildFloor(spec, input.bounds, options);
    floors.push(built.floor);
    adjacency.set(spec.level, built.adjacency);
  }

  const placement = placeExtras({
    bounds: input.bounds,
    requests: input.extras ?? [],
    floors: input.floors.length,
  });

  const house: House = {
    bounds: input.bounds,
    floors,
    extras: placement.extras,
    roof: {
      type: input.roof?.type ?? 'gable',
      pitch: input.roof?.pitch ?? 25,
      overhang: input.roof?.overhang ?? 0.5,
    },
    ceilingHeight: layout.ceilingHeight,
    wallThickness: thickness,
  };

  return { house, adjacency, skippedExtras: placement.skipped };
}

export function pickStairs(tree: TreeNode, bounds: Rect): Stairs | undefined {
  const rooms = computeRooms(tree, bounds);
  const host =
    rooms.find((r) => r.roomType === 'corridor') ??
    rooms.filter((r) => r.roomType !== 'bathroom').sort((a, b) => b.area - a.area)[0];

  if (!host) return undefined;

  const width = Math.min(1.2, host.rect.width * 0.6);
  const length = Math.min(3.2, host.rect.length * 0.7);

  return {
    x: host.rect.x + (host.rect.width - width) / 2,
    y: host.rect.y + (host.rect.length - length) / 2,
    width,
    length,
  };
}
