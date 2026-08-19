import { wallLength } from './adjacency';
import { buildRoof, eaveHeightFor } from './roof';
import type {
  Floor,
  House,
  HouseMesh,
  MeshMaterial,
  MeshPart,
  Opening,
  Room,
  Stairs,
  Vec3,
  Wall,
} from './types';

const WINDOW_SILL = 0.9;
const SLAB_THICKNESS = 0.25;
const GLASS_THICKNESS = 0.03;
const DOOR_PANEL_THICKNESS = 0.05;

export interface MeshOptions {
  includeRoof?: boolean;
  includeCeiling?: boolean;
  includeFurnitureSlots?: boolean;
}

export function buildMesh(house: House, options: MeshOptions = {}): HouseMesh {
  const { includeRoof = true, includeCeiling = false } = options;
  const parts: MeshPart[] = [];

  for (const floor of house.floors) {
    const base = floorBaseHeight(floor.level, house.ceilingHeight);

    parts.push(...floorSlabs(floor, base));
    parts.push(...wallParts(floor, base, house.ceilingHeight));

    if (includeCeiling) {
      parts.push(...ceilingSlabs(floor, base + house.ceilingHeight));
    }

    if (floor.stairs) {
      parts.push(stairsPart(floor.stairs, base, house.ceilingHeight, floor.level));
    }
  }

  parts.push(...extraParts(house));

  if (includeRoof) {
    const eaveHeight = eaveHeightFor(house.floors.length, house.ceilingHeight, SLAB_THICKNESS);
    const roof = buildRoof({ bounds: house.bounds, spec: house.roof, eaveHeight });

    for (const plane of [...roof.planes, ...roof.gables]) {
      parts.push(polygonPart(`roof-${plane.id}`, 'roof', plane.vertices));
    }
  }

  return {
    parts,
    bbox: boundingBox(parts),
    triangleCount: parts.reduce((sum, part) => sum + part.indices.length / 3, 0),
  };
}

function floorSlabs(floor: Floor, baseZ: number): MeshPart[] {
  return floor.rooms.map((room) =>
    slabPart(`floor-${floor.level}-${room.id}`, 'floor', room, baseZ - SLAB_THICKNESS, baseZ, room.id, floor.level),
  );
}

function ceilingSlabs(floor: Floor, topZ: number): MeshPart[] {
  return floor.rooms.map((room) =>
    slabPart(`ceiling-${floor.level}-${room.id}`, 'ceiling', room, topZ, topZ + 0.05, room.id, floor.level),
  );
}

function slabPart(
  id: string,
  material: MeshMaterial,
  room: Room,
  z0: number,
  z1: number,
  roomId: string,
  floorLevel: number,
): MeshPart {
  const { x, y, width, length } = room.rect;
  const builder = createBuilder();

  builder.box(
    { x, y },
    { x: x + width, y },
    length,
    z0,
    z1,
    'edge',
  );

  return { id, material, roomId, floor: floorLevel, ...builder.result() };
}

function wallParts(floor: Floor, baseZ: number, ceilingHeight: number): MeshPart[] {
  const parts: MeshPart[] = [];
  const top = baseZ + ceilingHeight;
  const byWall = new Map<string, Opening[]>();

  for (const opening of floor.openings) {
    const list = byWall.get(opening.wallId);
    if (list) list.push(opening);
    else byWall.set(opening.wallId, [opening]);
  }

  for (const wall of floor.walls) {
    const openings = (byWall.get(wall.id) ?? []).sort((a, b) => a.offset - b.offset);
    const material: MeshMaterial = wall.exterior ? 'wall-exterior' : 'wall-interior';

    parts.push({
      id: `wall-${floor.level}-${wall.id}`,
      material,
      floor: floor.level,
      ...solidWall(wall, openings, baseZ, top).result(),
    });

    for (const opening of openings) {
      const part = openingPart(wall, opening, baseZ, floor.level);
      if (part) parts.push(part);
    }
  }

  return parts;
}

function solidWall(wall: Wall, openings: Opening[], baseZ: number, topZ: number) {
  const builder = createBuilder();
  const total = wallLength(wall);
  if (total === 0) return builder;

  const from = wall.from;
  const to = wall.to;
  const dir = direction(wall);
  const at = (distance: number) => ({
    x: from.x + dir.x * distance,
    y: from.y + dir.y * distance,
  });

  let cursor = 0;

  for (const opening of openings) {
    const start = Math.max(0, opening.offset - opening.width / 2);
    const end = Math.min(total, opening.offset + opening.width / 2);
    const sill = baseZ + sillOf(opening);
    const header = sill + opening.height;

    if (start > cursor + 0.005) {
      builder.box(at(cursor), at(start), wall.thickness, baseZ, topZ);
    }

    if (sill > baseZ + 0.005) {
      builder.box(at(start), at(end), wall.thickness, baseZ, sill);
    }

    if (header < topZ - 0.005) {
      builder.box(at(start), at(end), wall.thickness, header, topZ);
    }

    cursor = Math.max(cursor, end);
  }

  if (cursor < total - 0.005) {
    builder.box(at(cursor), { x: to.x, y: to.y }, wall.thickness, baseZ, topZ);
  }

  return builder;
}

function openingPart(wall: Wall, opening: Opening, baseZ: number, floorLevel: number): MeshPart | null {
  const total = wallLength(wall);
  if (total === 0) return null;

  const dir = direction(wall);
  const start = Math.max(0, opening.offset - opening.width / 2);
  const end = Math.min(total, opening.offset + opening.width / 2);
  const sill = baseZ + sillOf(opening);

  const a = { x: wall.from.x + dir.x * start, y: wall.from.y + dir.y * start };
  const b = { x: wall.from.x + dir.x * end, y: wall.from.y + dir.y * end };

  const builder = createBuilder();
  const isWindow = opening.kind === 'window';

  builder.box(
    a,
    b,
    isWindow ? GLASS_THICKNESS : DOOR_PANEL_THICKNESS,
    sill,
    sill + opening.height,
  );

  return {
    id: `${isWindow ? 'glass' : 'door'}-${floorLevel}-${opening.id}`,
    material: isWindow ? 'glass' : 'door',
    floor: floorLevel,
    ...builder.result(),
  };
}

function sillOf(opening: Opening): number {
  return opening.kind === 'window' ? WINDOW_SILL : 0;
}

const GARAGE_HEIGHT_FACTOR = 0.82;
const PLATFORM_THICKNESS = 0.3;
const BASEMENT_DEPTH = 2.4;

function extraParts(house: House): MeshPart[] {
  const parts: MeshPart[] = [];

  for (const extra of house.extras) {
    const base = floorBaseHeight(Math.max(1, extra.floor), house.ceilingHeight);
    const builder = createBuilder();

    if (extra.kind === 'basement') {
      builder.box(
        { x: extra.rect.x, y: extra.rect.y },
        { x: extra.rect.x + extra.rect.width, y: extra.rect.y },
        extra.rect.length,
        -BASEMENT_DEPTH,
        -SLAB_THICKNESS,
        'edge',
      );
    } else if (extra.enclosed) {
      builder.box(
        { x: extra.rect.x, y: extra.rect.y },
        { x: extra.rect.x + extra.rect.width, y: extra.rect.y },
        extra.rect.length,
        base - SLAB_THICKNESS,
        base + house.ceilingHeight * GARAGE_HEIGHT_FACTOR,
        'edge',
      );
    } else {
      builder.box(
        { x: extra.rect.x, y: extra.rect.y },
        { x: extra.rect.x + extra.rect.width, y: extra.rect.y },
        extra.rect.length,
        base - PLATFORM_THICKNESS,
        base,
        'edge',
      );
    }

    parts.push({
      id: `extra-${extra.kind}-${extra.id}`,
      material: extra.enclosed ? 'wall-exterior' : 'floor',
      floor: extra.floor,
      ...builder.result(),
    });
  }

  return parts;
}

function stairsPart(stairs: Stairs, baseZ: number, ceilingHeight: number, floorLevel: number): MeshPart {
  const builder = createBuilder();
  const steps = Math.max(3, Math.round(ceilingHeight / 0.18));
  const stepRise = ceilingHeight / steps;
  const stepRun = stairs.length / steps;

  for (let i = 0; i < steps; i++) {
    const y = stairs.y + stepRun * i;
    builder.box(
      { x: stairs.x, y },
      { x: stairs.x + stairs.width, y },
      stepRun,
      baseZ,
      baseZ + stepRise * (i + 1),
      'edge',
    );
  }

  return { id: `stairs-${floorLevel}`, material: 'stairs', floor: floorLevel, ...builder.result() };
}

function polygonPart(id: string, material: MeshMaterial, vertices: Vec3[]): MeshPart {
  const builder = createBuilder();
  builder.polygon(vertices);
  return { id, material, ...builder.result() };
}

interface Builder {
  box(
    from: { x: number; y: number },
    to: { x: number; y: number },
    thickness: number,
    z0: number,
    z1: number,
    mode?: 'center' | 'edge',
  ): void;
  polygon(vertices: Vec3[]): void;
  result(): { positions: number[]; indices: number[] };
}

function createBuilder(): Builder {
  const positions: number[] = [];
  const indices: number[] = [];

  const pushVertex = (x: number, y: number, z: number): number => {
    const index = positions.length / 3;
    positions.push(x, z, y);
    return index;
  };

  const quad = (a: number, b: number, c: number, d: number) => {
    indices.push(a, b, c, a, c, d);
  };

  return {
    box(from, to, thickness, z0, z1, mode = 'center') {
      const dx = to.x - from.x;
      const dy = to.y - from.y;
      const length = Math.hypot(dx, dy);
      if (length === 0 || z1 - z0 <= 0) return;

      const nx = -dy / length;
      const ny = dx / length;
      const near = mode === 'center' ? thickness / 2 : thickness;
      const far = mode === 'center' ? thickness / 2 : 0;

      const corners: Array<[number, number]> = [
        [from.x + nx * near, from.y + ny * near],
        [to.x + nx * near, to.y + ny * near],
        [to.x - nx * far, to.y - ny * far],
        [from.x - nx * far, from.y - ny * far],
      ];

      const bottom = corners.map(([x, y]) => pushVertex(x, y, z0));
      const top = corners.map(([x, y]) => pushVertex(x, y, z1));

      quad(bottom[0], bottom[3], bottom[2], bottom[1]);
      quad(top[0], top[1], top[2], top[3]);
      quad(bottom[0], bottom[1], top[1], top[0]);
      quad(bottom[1], bottom[2], top[2], top[1]);
      quad(bottom[2], bottom[3], top[3], top[2]);
      quad(bottom[3], bottom[0], top[0], top[3]);
    },

    polygon(vertices) {
      if (vertices.length < 3) return;

      const base = vertices.map((v) => pushVertex(v.x, v.y, v.z));
      for (let i = 1; i < base.length - 1; i++) {
        indices.push(base[0], base[i], base[i + 1]);
      }
    },

    result() {
      return { positions, indices };
    },
  };
}

function direction(wall: Wall): { x: number; y: number } {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function floorBaseHeight(level: number, ceilingHeight: number): number {
  return (level - 1) * (ceilingHeight + SLAB_THICKNESS);
}

function boundingBox(parts: MeshPart[]): { min: Vec3; max: Vec3 } {
  const min = { x: Infinity, y: Infinity, z: Infinity };
  const max = { x: -Infinity, y: -Infinity, z: -Infinity };

  for (const part of parts) {
    for (let i = 0; i < part.positions.length; i += 3) {
      const x = part.positions[i];
      const height = part.positions[i + 1];
      const depth = part.positions[i + 2];

      min.x = Math.min(min.x, x);
      min.z = Math.min(min.z, height);
      min.y = Math.min(min.y, depth);
      max.x = Math.max(max.x, x);
      max.z = Math.max(max.z, height);
      max.y = Math.max(max.y, depth);
    }
  }

  if (!Number.isFinite(min.x)) {
    return { min: { x: 0, y: 0, z: 0 }, max: { x: 0, y: 0, z: 0 } };
  }

  return { min, max };
}
