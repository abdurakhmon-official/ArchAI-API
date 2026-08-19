import { addRoom, removeRoom, type SplitOptions } from './split';
import { computeRooms, countByType, leaves } from './tree';
import type { Rect, TreeNode } from './types';

const MAX_ADDITIONS = 8;
const MAX_REMOVALS = 16;

/**
 * So'ralgan, lekin joylashtirilmagan xona.
 *
 * Ilgari bunday holat JIMGINA o'tib ketardi: `addRoom` xato tashlasa
 * sikl `break` qilardi va hech qayerda iz qolmasdi. Foydalanuvchi 4 ta
 * yotoqxona so'rab 2 tasini olardi va nima uchunligini bilmasdi —
 * "generator ishlamadi" degan taassurot aynan shundan tug'iladi.
 */
export interface SkippedRoom {
  roomType: string;
  /** Foydalanuvchi so'ragan soni. */
  wanted: number;
  /** Haqiqatan joylashgan soni. */
  placed: number;
  /**
   * `NO_SPACE` — yerga sig'madi (eng ko'p uchraydigani);
   * `LIMIT`    — bitta yurishdagi qo'shish chegarasiga yetildi;
   * `FAILED`   — geometriya boshqa sababdan bo'linmadi.
   */
  reason: 'NO_SPACE' | 'LIMIT' | 'FAILED';
}

export interface ProgramSteps {
  roomsAdded: number;
  roomsRemoved: number;
  /** Sig'magan xonalar — bo'sh massiv "hammasi joylashdi" degani. */
  skipped: SkippedRoom[];
}

export type RoomProgram = Record<string, number>;

export function applyRoomProgram(
  trees: TreeNode[],
  bounds: Rect,
  requested: RoomProgram,
  options: SplitOptions,
  steps: ProgramSteps,
): TreeNode[] {
  const current = trees.map((tree) => ({ ...tree }) as TreeNode);

  for (const [roomType, wanted] of Object.entries(requested)) {
    if (typeof wanted !== 'number' || !Number.isFinite(wanted)) continue;

    let have = current.reduce((sum, tree) => sum + (countByType(tree)[roomType] ?? 0), 0);
    let guard = 0;
    let failure: SkippedRoom['reason'] | null = null;

    while (have < wanted && guard++ < MAX_ADDITIONS) {
      const index = floorWithMostSpace(current, bounds);

      try {
        current[index] = addRoom(current[index], bounds, roomType, options);
      } catch (error) {
        /*
          Sabab saqlanadi, yutilmaydi.

          `NO_SPACE` — eng ko'p uchraydigani va foydalanuvchiga
          tushunarli aytish mumkin bo'lgani: yer kichik. Boshqa
          xatolar geometriyaning ichki holati bilan bog'liq va ularni
          "sig'madi" deb ko'rsatish yolg'on bo'lardi.
        */
        failure = isNoSpace(error) ? 'NO_SPACE' : 'FAILED';
        break;
      }

      steps.roomsAdded += 1;
      have += 1;
    }

    // Chegaraga yetib to'xtash ham sig'masligining bir turi.
    if (have < wanted && !failure) failure = 'LIMIT';

    if (have < wanted) {
      steps.skipped.push({ roomType, wanted, placed: have, reason: failure! });
    }

    guard = 0;
    while (have > wanted && guard++ < MAX_REMOVALS) {
      const target = smallestOfType(current, bounds, roomType);
      if (!target) break;

      current[target.floor] = removeRoom(current[target.floor], target.roomId);
      steps.roomsRemoved += 1;
      have -= 1;
    }
  }

  return current;
}

/**
 * Xato "joy yetmadi" degani ekanini aniqlaydi.
 *
 * `instanceof GeometryError` ishlatilmaydi: bu fayl brauzerga
 * nusxalanadi va u yerda modul nusxasi boshqa bo'lishi mumkin —
 * `instanceof` esa shunda yolg'on qaytaradi. Kod bo'yicha tekshirish
 * ikkala tomonda ham bir xil ishlaydi.
 */
function isNoSpace(error: unknown): boolean {
  return (error as { code?: string } | null)?.code === 'NO_SPACE';
}

function floorWithMostSpace(trees: TreeNode[], bounds: Rect): number {
  let best = 0;
  let bestArea = -1;

  for (let index = 0; index < trees.length; index++) {
    const areas = computeRooms(trees[index], bounds).map((room) => room.area);
    const largest = areas.length === 0 ? 0 : Math.max(...areas);

    if (largest > bestArea) {
      bestArea = largest;
      best = index;
    }
  }

  return best;
}

function smallestOfType(
  trees: TreeNode[],
  bounds: Rect,
  roomType: string,
): { floor: number; roomId: string } | null {
  let bestFloor = -1;
  let bestRoomId = '';
  let bestArea = Infinity;

  for (let index = 0; index < trees.length; index++) {
    if (leaves(trees[index]).length <= 1) continue;

    for (const room of computeRooms(trees[index], bounds)) {
      if (room.roomType !== roomType) continue;
      if (room.area >= bestArea) continue;

      bestFloor = index;
      bestRoomId = room.id;
      bestArea = room.area;
    }
  }

  return bestFloor === -1 ? null : { floor: bestFloor, roomId: bestRoomId };
}
