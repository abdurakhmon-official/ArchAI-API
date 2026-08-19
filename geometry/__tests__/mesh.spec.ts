import { buildHouse, pickStairs } from '../layout';
import { buildMesh } from '../mesh';
import type { HouseMesh, MeshMaterial } from '../types';
import { BOUNDS, OPTIONS, sampleTree } from './fixtures';

const single = buildHouse({ bounds: BOUNDS, floors: [{ level: 1, tree: sampleTree() }] }, OPTIONS).house;

const mesh = buildMesh(single);

const materialsOf = (m: HouseMesh) => new Set(m.parts.map((part) => part.material));
const partsWith = (m: HouseMesh, material: MeshMaterial) =>
  m.parts.filter((part) => part.material === material);

const triangleCount = (m: HouseMesh) =>
  m.parts.reduce((sum, part) => sum + part.indices.length / 3, 0);

describe('3D mesh structure', () => {
  it('triangles come out', () => {
    expect(mesh.triangleCount).toBeGreaterThan(0);
    expect(mesh.parts.length).toBeGreaterThan(0);
  });

  it('the declared triangle count matches the real one', () => {
    expect(mesh.triangleCount).toBe(triangleCount(mesh));
  });

  describe('buffer integrity', () => {
    it('coordinates come in groups of three', () => {
      for (const part of mesh.parts) {
        expect(part.positions.length % 3).toBe(0);
        expect(part.positions.length).toBeGreaterThan(0);
      }
    });

    it('indices come in groups of three', () => {
      for (const part of mesh.parts) {
        expect(part.indices.length % 3).toBe(0);
      }
    });

    it('every index stays within its buffer', () => {
      for (const part of mesh.parts) {
        const vertexCount = part.positions.length / 3;
        for (const index of part.indices) {
          expect(Number.isInteger(index)).toBe(true);
          expect(index).toBeGreaterThanOrEqual(0);
          expect(index).toBeLessThan(vertexCount);
        }
      }
    });

    it('no coordinate is corrupted', () => {
      for (const part of mesh.parts) {
        for (const value of part.positions) {
          expect(Number.isFinite(value)).toBe(true);
        }
      }
    });

    it('no degenerate triangle — every one has area', () => {
      let degenerate = 0;

      for (const part of mesh.parts) {
        for (let i = 0; i < part.indices.length; i += 3) {
          const [a, b, c] = [part.indices[i], part.indices[i + 1], part.indices[i + 2]];
          if (a === b || b === c || a === c) degenerate += 1;
        }
      }

      expect(degenerate).toBe(0);
    });
  });

  describe('coordinate system', () => {
    it('three.js is Y-up: height is the second component', () => {
      const floorParts = partsWith(mesh, 'floor');
      const heights = floorParts.flatMap((part) =>
        part.positions.filter((_, index) => index % 3 === 1),
      );

      // Birinchi qavat poli nol atrofida — plita qalinligi hisobga olinganda.
      expect(Math.max(...heights)).toBeCloseTo(0, 5);
      expect(Math.min(...heights)).toBeCloseTo(-0.25, 5);
    });

    it('walls run from floor to ceiling', () => {
      const wallParts = partsWith(mesh, 'wall-exterior');
      const heights = wallParts.flatMap((part) =>
        part.positions.filter((_, index) => index % 3 === 1),
      );

      expect(Math.max(...heights)).toBeCloseTo(single.ceilingHeight, 5);
      expect(Math.min(...heights)).toBeCloseTo(0, 5);
    });
  });

  describe('materials', () => {
    it('floor, wall, roof and glass are present', () => {
      const materials = materialsOf(mesh);
      expect(materials).toContain('floor');
      expect(materials).toContain('wall-exterior');
      expect(materials).toContain('wall-interior');
      expect(materials).toContain('roof');
      expect(materials).toContain('glass');
      expect(materials).toContain('door');
    });

    it('every window has a pane', () => {
      const windows = single.floors[0].openings.filter((o) => o.kind === 'window');
      expect(partsWith(mesh, 'glass')).toHaveLength(windows.length);
    });

    it('a separate floor per room — for the interior camera', () => {
      const floorParts = partsWith(mesh, 'floor');
      expect(floorParts).toHaveLength(single.floors[0].rooms.length);

      for (const part of floorParts) {
        expect(part.roomId).toBeDefined();
        expect(part.floor).toBe(1);
      }
    });
  });

  describe('openings cut the wall', () => {
    it('an opening makes the wall geometry richer', () => {
      const withoutOpenings = buildHouse(
        { bounds: BOUNDS, floors: [{ level: 1, tree: sampleTree() }] },
        OPTIONS,
      ).house;
      withoutOpenings.floors[0].openings = [];

      const bare = buildMesh(withoutOpenings, { includeRoof: false });
      const full = buildMesh(single, { includeRoof: false });

      const wallTriangles = (m: HouseMesh) =>
        m.parts
          .filter((part) => part.material === 'wall-exterior' || part.material === 'wall-interior')
          .reduce((sum, part) => sum + part.indices.length / 3, 0);

      // Ochiqlik atrofida devor bo'laklarga bo'linadi — uchburchak ko'payadi.
      expect(wallTriangles(full)).toBeGreaterThan(wallTriangles(bare));
    });
  });

  describe('options', () => {
    it('the roof can be switched off — for the cutaway view', () => {
      const cutaway = buildMesh(single, { includeRoof: false });
      expect(materialsOf(cutaway).has('roof')).toBe(false);
      expect(cutaway.triangleCount).toBeLessThan(mesh.triangleCount);
    });

    it('a ceiling can be added', () => {
      const withCeiling = buildMesh(single, { includeCeiling: true });
      expect(materialsOf(withCeiling)).toContain('ceiling');
    });
  });

  describe('bounding box', () => {
    it('wraps the house completely', () => {
      expect(mesh.bbox.min.x).toBeLessThanOrEqual(BOUNDS.x);
      expect(mesh.bbox.max.x).toBeGreaterThanOrEqual(BOUNDS.x + BOUNDS.width);
      expect(mesh.bbox.min.y).toBeLessThanOrEqual(BOUNDS.y);
      expect(mesh.bbox.max.y).toBeGreaterThanOrEqual(BOUNDS.y + BOUNDS.length);
    });

    it('the height reaches the ridge', () => {
      expect(mesh.bbox.max.z).toBeGreaterThan(single.ceilingHeight);
    });

    it('holds for an empty mesh too', () => {
      const empty = buildMesh(
        { ...single, floors: [], roof: single.roof },
        { includeRoof: false },
      );
      expect(empty.bbox.min).toEqual({ x: 0, y: 0, z: 0 });
      expect(empty.triangleCount).toBe(0);
    });
  });

  describe('multiple floors', () => {
    const tree = sampleTree();
    const stairs = pickStairs(tree, BOUNDS);
    const twoFloors = buildHouse(
      {
        bounds: BOUNDS,
        floors: [
          { level: 1, tree, stairs },
          { level: 2, tree: sampleTree(), stairs },
        ],
      },
      OPTIONS,
    ).house;

    const stacked = buildMesh(twoFloors);

    it('the second floor sits above the first', () => {
      const heightsOn = (level: number) =>
        stacked.parts
          .filter((part) => part.floor === level && part.material === 'floor')
          .flatMap((part) => part.positions.filter((_, index) => index % 3 === 1));

      expect(Math.max(...heightsOn(2))).toBeGreaterThan(Math.max(...heightsOn(1)));
    });

    it('floors do not run into each other', () => {
      const topOfFirst = Math.max(
        ...stacked.parts
          .filter((part) => part.floor === 1 && part.material === 'wall-exterior')
          .flatMap((part) => part.positions.filter((_, index) => index % 3 === 1)),
      );
      const bottomOfSecond = Math.min(
        ...stacked.parts
          .filter((part) => part.floor === 2 && part.material === 'floor')
          .flatMap((part) => part.positions.filter((_, index) => index % 3 === 1)),
      );

      expect(bottomOfSecond).toBeGreaterThanOrEqual(topOfFirst - 1e-6);
    });

    it('the stair treads come out', () => {
      expect(materialsOf(stacked)).toContain('stairs');
    });

    it('two floors give more triangles than one', () => {
      expect(stacked.triangleCount).toBeGreaterThan(mesh.triangleCount);
    });
  });
});
