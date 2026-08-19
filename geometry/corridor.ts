/**
 * Koridor generatsiyasi.
 *
 * Muammo: skeletda koridor bo'lmasa, yotoqxonaga sanuzel orqali kirishga
 * to'g'ri keladi — bu reja sifatidagi eng ko'p uchraydigan xato va
 * foydalanuvchi ishonchini bir zumda yo'qotadi.
 *
 * Yechim: kirishdan qaysi xonalarga qonuniy yo'l yo'qligini aniqlaymiz va
 * eng mos xonadan koridor tasmasini ajratamiz. Tasma qaysi tomondan
 * kesilishi ham hisoblanadi — u ulanmagan xonalarga qaragan bo'lishi kerak.
 */

import { buildAdjacency, wallLength } from './adjacency';
import { pickEntryRoom } from './openings';
import { clamp, GeometryError, type SplitOptions } from './split';
import { cloneTree, computeRects, computeRooms, isLeaf, nextNodeId } from './tree';
import {
  DEFAULT_WALL_THICKNESS,
  DOOR_WIDTH,
  type Rect,
  type Room,
  type RoomTypeRule,
  type SplitNode,
  type TreeNode,
} from './types';
import { maxRatioFor } from './validate';

/** Koridor bundan tor bo'lsa yurib bo'lmaydi. */
const MIN_CORRIDOR_WIDTH = 1.1;
const MAX_CARVE_ATTEMPTS = 3;

/**
 * Ikki xona qo'shni bo'lsa ham, umumiy devori eshik sig'maydigan darajada
 * qisqa bo'lishi mumkin. Bunday qo'shnilik yurish yo'li hisoblanmaydi —
 * aks holda "ulangan" deb belgilangan xonaga amalda kirib bo'lmay qoladi.
 */
const MIN_DOOR_WALL = DOOR_WIDTH + 0.2;

export interface CorridorOptions extends SplitOptions {
  corridorWidth?: number;
  /** Koridor xona turining kodi — lug'atda shu nom bilan turadi. */
  corridorType?: string;
}

/**
 * Bargdan koridor tasmasini ajratish.
 *
 * `place` tasma qaysi chekkadan olinishini belgilaydi: `start` — chap yoki
 * yuqori, `end` — o'ng yoki past.
 */
export function carveCorridor(
  root: TreeNode,
  bounds: Rect,
  leafId: string,
  options: CorridorOptions,
  axis: SplitNode['axis'],
  place: 'start' | 'end',
): TreeNode {
  const width = Math.max(options.corridorWidth ?? 1.4, MIN_CORRIDOR_WIDTH);
  const corridorType = options.corridorType ?? 'corridor';

  const rects = computeRects(root, bounds);
  const rect = rects.get(leafId);
  if (!rect) throw new GeometryError(`leaf not found: ${leafId}`, 'LEAF_NOT_FOUND');

  const node = findLeafNode(root, leafId);
  if (!node) throw new GeometryError(`leaf not found: ${leafId}`, 'LEAF_NOT_FOUND');

  const span = axis === 'vertical' ? rect.width : rect.length;
  const cross = axis === 'vertical' ? rect.length : rect.width;

  // Tasma ajratilgandan keyin xona o'z minimalidan pastga tushmasin.
  const minHost = (options.rules[node.roomType]?.minArea ?? 6) * (options.minAreaFactor ?? 1);
  const remaining = (span - width) * cross;

  if (width >= span || remaining < minHost) {
    throw new GeometryError(
      `room too small to carve a corridor: ${node.roomType}`,
      'NO_SPACE',
    );
  }

  // Ikkala bo'lak ham o'z turining proporsiya chegarasida qolsin: koridor
  // cho'ziq bo'lishi mumkin, lekin cheksiz emas; xona esa yassi bo'lmasin.
  if (!fitsRatio(width, cross, options.rules[corridorType])) {
    throw new GeometryError(`corridor would be too narrow in ${node.roomType}`, 'TOO_NARROW');
  }
  if (!fitsRatio(span - width, cross, options.rules[node.roomType])) {
    throw new GeometryError(`carving a corridor would flatten ${node.roomType}`, 'TOO_NARROW');
  }

  const corridorShare = clamp(width / span, 0.08, 0.6);
  const clone = cloneTree(root);
  const corridorId = nextNodeId(clone);
  const splitId = nextNodeId(clone, 's');

  const host: TreeNode = { kind: 'leaf', id: node.id, roomType: node.roomType, label: node.label };
  const corridor: TreeNode = { kind: 'leaf', id: corridorId, roomType: corridorType };

  const replacement: SplitNode = {
    kind: 'split',
    id: splitId,
    axis,
    ratio: place === 'start' ? corridorShare : 1 - corridorShare,
    children: place === 'start' ? [corridor, host] : [host, corridor],
  };

  return replaceNode(clone, leafId, replacement);
}

/**
 * Kirishdan har bir xonaga qonuniy yo'l bo'lishini ta'minlash.
 *
 * Yo'l topilmagan xonalar bo'lsa, ularga eng yaqin turgan xonadan koridor
 * ajratiladi va tekshiruv qaytariladi. Uch urinishdan keyin to'xtaydi —
 * bunday holatda skeletning o'zi noto'g'ri tuzilgan bo'ladi.
 */
export function ensureCirculation(
  root: TreeNode,
  bounds: Rect,
  options: CorridorOptions,
): { tree: TreeNode; carved: number; unreachable: string[] } {
  let tree = cloneTree(root);
  let carved = 0;

  for (let attempt = 0; attempt < MAX_CARVE_ATTEMPTS; attempt++) {
    const analysis = analyse(tree, bounds, options);
    if (analysis.unreachable.length === 0) {
      return { tree, carved, unreachable: [] };
    }

    const choices = pickHosts(analysis, options);
    let carvedThisRound = false;

    // Nomzodlar foydalilik bo'yicha saralangan; birinchisi mos kelmasa
    // (masalan proporsiya buzilsa) keyingisiga o'tamiz.
    for (const choice of choices) {
      try {
        tree = carveCorridor(tree, bounds, choice.hostId, options, choice.axis, choice.place);
        carved += 1;
        carvedThisRound = true;
        break;
      } catch {
        continue;
      }
    }

    if (!carvedThisRound) {
      return { tree, carved, unreachable: analysis.unreachable.map((room) => room.id) };
    }
  }

  const final = analyse(tree, bounds, options);
  return { tree, carved, unreachable: final.unreachable.map((room) => room.id) };
}

// ---------------------------------------------------------------------------

interface Analysis {
  rooms: Room[];
  byId: Map<string, Room>;
  neighbors: Map<string, string[]>;
  reachable: Set<string>;
  unreachable: Room[];
  entryId: string | null;
}

function analyse(tree: TreeNode, bounds: Rect, options: CorridorOptions): Analysis {
  const rooms = computeRooms(tree, bounds);
  const { neighbors: rawNeighbors, walls } = buildAdjacency(rooms, bounds, DEFAULT_WALL_THICKNESS);
  const byId = new Map(rooms.map((room) => [room.id, room]));

  // Eshik sig'maydigan qo'shniliklarni chiqarib tashlaymiz.
  const sharedWall = new Map<string, number>();
  for (const wall of walls) {
    if (wall.exterior || wall.rooms.length < 2) continue;
    const key = pairKey(wall.rooms[0], wall.rooms[1]);
    sharedWall.set(key, (sharedWall.get(key) ?? 0) + wallLength(wall));
  }

  const neighbors = new Map<string, string[]>();
  for (const [roomId, list] of rawNeighbors) {
    neighbors.set(
      roomId,
      list.filter((other) => (sharedWall.get(pairKey(roomId, other)) ?? 0) >= MIN_DOOR_WALL),
    );
  }

  const entry = pickEntryRoom(rooms, walls);
  const reachable = new Set<string>();

  if (entry) {
    reachable.add(entry.id);

    let progress = true;
    while (progress) {
      progress = false;

      for (const current of [...reachable]) {
        const fromType = byId.get(current)?.roomType ?? '';

        for (const next of neighbors.get(current) ?? []) {
          if (reachable.has(next)) continue;

          const toType = byId.get(next)?.roomType ?? '';
          const rule = options.rules[toType];
          const allowed = !rule || rule.accessFrom.length === 0 || rule.accessFrom.includes(fromType);
          if (!allowed) continue;

          reachable.add(next);
          progress = true;
        }
      }
    }
  }

  return {
    rooms,
    byId,
    neighbors,
    reachable,
    unreachable: rooms.filter((room) => !reachable.has(room.id)),
    entryId: entry?.id ?? null,
  };
}

interface HostChoice {
  hostId: string;
  axis: SplitNode['axis'];
  place: 'start' | 'end';
  serves: number;
}

/**
 * Koridor qaysi xonadan ajratilishi kerak.
 *
 * Eng yaxshi nomzod — ulanmagan xonalarning ko'pchiligiga tegib turgan,
 * o'zi ulangan va tasma bergandan keyin ham yetarli maydonga ega xona.
 */
function pickHosts(analysis: Analysis, options: CorridorOptions): HostChoice[] {
  const width = Math.max(options.corridorWidth ?? 1.4, MIN_CORRIDOR_WIDTH);
  const corridorRule = options.rules[options.corridorType ?? 'corridor'];
  const unreachableIds = new Set(analysis.unreachable.map((room) => room.id));
  const candidates: HostChoice[] = [];

  for (const room of analysis.rooms) {
    if (!analysis.reachable.has(room.id)) continue;
    if (room.roomType === 'corridor') continue;

    const served = (analysis.neighbors.get(room.id) ?? []).filter((id) => unreachableIds.has(id));
    if (served.length === 0) continue;

    const minHost = (options.rules[room.roomType]?.minArea ?? 6) * (options.minAreaFactor ?? 1);

    // Yo'nalish: ulanmagan qo'shnilar qaysi tomonda ko'proq bo'lsa,
    // tasma o'sha tomondan olinadi.
    const center = centerOf(room);
    let dx = 0;
    let dy = 0;

    for (const id of served) {
      const neighbor = analysis.byId.get(id);
      if (!neighbor) continue;
      const other = centerOf(neighbor);
      dx += other.x - center.x;
      dy += other.y - center.y;
    }

    const axis: SplitNode['axis'] = Math.abs(dx) >= Math.abs(dy) ? 'vertical' : 'horizontal';
    const span = axis === 'vertical' ? room.rect.width : room.rect.length;
    const cross = axis === 'vertical' ? room.rect.length : room.rect.width;

    if (width >= span) continue;
    if ((span - width) * cross < minHost) continue;

    // Tasma ham, qolgan xona ham proporsiya chegarasida qolishi kerak.
    if (!fitsRatio(width, cross, corridorRule)) continue;
    if (!fitsRatio(span - width, cross, options.rules[room.roomType])) continue;

    candidates.push({
      hostId: room.id,
      axis,
      place: (axis === 'vertical' ? dx : dy) >= 0 ? 'end' : 'start',
      serves: served.length,
    });
  }

  candidates.sort((first, second) => second.serves - first.serves);
  return candidates;
}

/** Berilgan o'lchamdagi to'rtburchak xona turi uchun yetarlicha to'lami. */
function fitsRatio(span: number, cross: number, rule?: RoomTypeRule): boolean {
  const long = Math.max(span, cross);
  const short = Math.min(span, cross);
  if (short <= 0) return false;
  return long / short <= maxRatioFor(rule);
}

function centerOf(room: Room): { x: number; y: number } {
  return {
    x: room.rect.x + room.rect.width / 2,
    y: room.rect.y + room.rect.length / 2,
  };
}

function pairKey(first: string, second: string): string {
  return first < second ? `${first}|${second}` : `${second}|${first}`;
}

function findLeafNode(root: TreeNode, id: string) {
  const stack: TreeNode[] = [root];

  while (stack.length > 0) {
    const node = stack.pop()!;
    if (node.id === id) return isLeaf(node) ? node : null;
    if (!isLeaf(node)) stack.push(node.children[0], node.children[1]);
  }

  return null;
}

function replaceNode(root: TreeNode, targetId: string, replacement: TreeNode): TreeNode {
  if (root.id === targetId) return replacement;
  if (isLeaf(root)) return root;

  return {
    ...root,
    children: [
      replaceNode(root.children[0], targetId, replacement),
      replaceNode(root.children[1], targetId, replacement),
    ],
  } as SplitNode;
}
