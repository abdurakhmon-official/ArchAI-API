import { writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { ensureCirculation } from '@/geometry/corridor';
import { drawFloor, toSvg } from '@/geometry/drawing';
import { buildHouse, pickStairs } from '@/geometry/layout';
import { measure } from '@/geometry/measure';
import { buildMesh } from '@/geometry/mesh';
import { fitAndRebalance } from '@/geometry/resize';
import { addRoom, removeRoom } from '@/geometry/split';
import { validateHouse } from '@/geometry/validate';
import type { Rect, RoomTypeRule, TreeNode } from '@/geometry/types';

const RULES: Record<string, RoomTypeRule> = {
  living: { code: 'living', minArea: 16, maxArea: 45, idealRatio: 1.5, needsExteriorWall: true, isWetZone: false, accessFrom: [] },
  bedroom: { code: 'bedroom', minArea: 9, maxArea: 25, idealRatio: 1.3, needsExteriorWall: true, isWetZone: false, accessFrom: ['corridor', 'hall'] },
  kitchen: { code: 'kitchen', minArea: 8, maxArea: 20, idealRatio: 1.4, needsExteriorWall: true, isWetZone: true, accessFrom: [] },
  bathroom: { code: 'bathroom', minArea: 3, maxArea: 8, idealRatio: 1.5, needsExteriorWall: false, isWetZone: true, accessFrom: ['corridor', 'living'] },
  corridor: { code: 'corridor', minArea: 3, maxArea: 20, idealRatio: 3, needsExteriorWall: false, isWetZone: false, accessFrom: [] },
  office: { code: 'office', minArea: 7, maxArea: 20, idealRatio: 1.3, needsExteriorWall: true, isWetZone: false, accessFrom: ['corridor', 'living'] },
};

const NAMES: Record<string, string> = {
  living: 'Mehmonxona',
  bedroom: 'Yotoqxona',
  kitchen: 'Oshxona',
  bathroom: 'Sanuzel',
  corridor: 'Koridor',
  office: 'Ish xonasi',
};

const OPTIONS = { rules: RULES };
const BOUNDS: Rect = { x: 0, y: 0, width: 12, length: 15 };

function baseTree(): TreeNode {
  return {
    kind: 'split', id: 's1', axis: 'vertical', ratio: 0.6,
    children: [
      {
        kind: 'split', id: 's2', axis: 'horizontal', ratio: 0.55,
        children: [
          { kind: 'leaf', id: 'n1', roomType: 'living' },
          {
            kind: 'split', id: 's3', axis: 'vertical', ratio: 0.55,
            children: [
              { kind: 'leaf', id: 'n2', roomType: 'kitchen' },
              { kind: 'leaf', id: 'n3', roomType: 'bathroom' },
            ],
          },
        ],
      },
      {
        kind: 'split', id: 's4', axis: 'horizontal', ratio: 0.5,
        children: [
          { kind: 'leaf', id: 'n4', roomType: 'bedroom' },
          { kind: 'leaf', id: 'n5', roomType: 'bedroom' },
        ],
      },
    ],
  };
}

interface Sample {
  title: string;
  note: string;
  svg: string;
  rooms: number;
  score: number;
  rawScore: number;
  carved: number;
  rebalanced: boolean;
  issues: string[];
  triangles: number;
  measurements: ReturnType<typeof measure>;
}

const scoreOf = (tree: TreeNode, bounds: Rect) =>
  validateHouse(buildHouse({ bounds, floors: [{ level: 1, tree }] }, OPTIONS).house, OPTIONS).score;

function render(
  title: string,
  note: string,
  raw: TreeNode,
  bounds: Rect,
  roofType: 'flat' | 'shed' | 'gable' | 'hip' = 'gable',
  floors = 1,
): Sample {
  const rawScore = scoreOf(raw, bounds);

  // To'liq sifat quvuri: avval yurish yo'li, keyin maydonni qayta taqsimlash.
  const circulation = ensureCirculation(raw, bounds, OPTIONS);
  const balancing = fitAndRebalance(circulation.tree, bounds, OPTIONS);
  const tree = balancing.tree;

  const stairs = floors > 1 ? pickStairs(tree, bounds) : undefined;
  const specs = Array.from({ length: floors }, (_, index) => ({ level: index + 1, tree, stairs }));

  const { house } = buildHouse(
    { bounds, floors: specs, roof: { type: roofType, pitch: 30, overhang: 0.5 } },
    OPTIONS,
  );

  const result = validateHouse(house, OPTIONS);

  return {
    title,
    note,
    svg: toSvg(drawFloor(house.floors[0], { names: NAMES }), { scale: 34 }),
    rooms: house.floors[0].rooms.length,
    score: result.score,
    rawScore,
    carved: circulation.carved,
    rebalanced: balancing.adjusted,
    issues: result.issues.map((issue) => `${issue.severity}: ${issue.message}`),
    triangles: buildMesh(house).triangleCount,
    measurements: measure(house),
  };
}

const samples: Sample[] = [];

samples.push(render('Asosiy reja', '12 × 15 m · 5 xona · ikki nishabli tom', baseTree(), BOUNDS));

const added = addRoom(baseTree(), BOUNDS, 'bedroom', OPTIONS);
samples.push(render('Yotoqxona qo‘shildi', 'Foydalanuvchi "yana bitta yotoqxona" dedi', added, BOUNDS));

const addedTwo = addRoom(added, BOUNDS, 'office', OPTIONS);
samples.push(render('Ish xonasi ham qo‘shildi', 'Ketma-ket ikkinchi qo‘shish', addedTwo, BOUNDS));

const removed = removeRoom(baseTree(), 'n3');
samples.push(render('Sanuzel olib tashlandi', 'Joyi qo‘shnisiga — oshxonaga o‘tdi', removed, BOUNDS));

samples.push(render('Kichikroq uy', 'O‘sha reja, 10 × 12 m ga cho‘zilgan', baseTree(), { x: 0, y: 0, width: 10, length: 12 }));
samples.push(render('Kattaroq uy', 'O‘sha reja, 16 × 18 m ga cho‘zilgan', baseTree(), { x: 0, y: 0, width: 16, length: 18 }));
samples.push(render('Ikki qavat', '12 × 15 m · zinapoya bilan · valma tom', baseTree(), BOUNDS, 'hip', 2));

const outputPath = join(__dirname, 'samples.json');
writeFileSync(outputPath, JSON.stringify(samples, null, 2), 'utf8');

console.log(`generated ${samples.length} samples -> ${outputPath}\n`);
for (const sample of samples) {
  console.log(
    `${sample.title.padEnd(26)} rooms=${String(sample.rooms).padStart(2)}  ` +
      `area=${String(sample.measurements.FLOOR_AREA).padStart(6)}m2  ` +
      `roof=${String(sample.measurements.ROOF_AREA).padStart(6)}m2  ` +
      `win=${String(sample.measurements.WINDOW_COUNT).padStart(2)}  ` +
      `door=${String(sample.measurements.DOOR_COUNT).padStart(2)}  ` +
      `score ${String(sample.rawScore).padStart(3)} -> ${String(sample.score).padStart(3)}  ` +
      `corridor=${sample.carved}  rebalanced=${sample.rebalanced ? 'ha' : 'yo'}  ` +
      `tris=${sample.triangles}`,
  );
  for (const issue of sample.issues) console.log(`    ${issue}`);
}
