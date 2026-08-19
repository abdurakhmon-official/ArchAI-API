import type { House, Rect, Room, RoomTypeRule, WallSide } from './types';

/**
 * Yo'nalish va quyosh.
 *
 * Reja chizmasining yuqori cheti har doim "shimol" emas: uchastka
 * ixtiyoriy tomonga qaragan bo'lishi mumkin. Foydalanuvchi chizmaning
 * QAYSI cheti shimolga qarashini aytadi, qolgani shundan hisoblanadi.
 *
 * DIQQAT: bu modul xonalarni QAYTA JOYLASHTIRMAYDI. U variantlarni
 * baholaydi — generator bir nechta variant quradi va shu ball ularning
 * tartibini belgilaydi. Xonalarni yo'nalish bo'yicha ataylab joylash
 * bo'linish algoritmini butunlay qayta yozishni talab qilardi.
 */

const ORDER: WallSide[] = ['north', 'east', 'south', 'west'];

/** Xona chetga tegadi deb hisoblanadigan masofa. */
const EDGE_TOLERANCE = 0.05;

export interface OrientationNote {
  roomId: string;
  roomType: string;
  /** Xona haqiqatan qaragan tomonlar — kompas bo'yicha. */
  facing: WallSide[];
  /** Xona turi uchun afzal tomonlar. */
  preferred: WallSide[];
  ok: boolean;
}

export interface OrientationResult {
  /** 0..100. Afzalligi bor xonalarning nechchi foizi to'g'ri turgani. */
  score: number;
  notes: OrientationNote[];
}

/**
 * Chizma chetidan kompas tomoniga.
 *
 * `northSide` — chizmaning qaysi cheti shimolga qaraydi.
 */
export function toCompass(edge: WallSide, northSide: WallSide): WallSide {
  const shift = (ORDER.indexOf(edge) - ORDER.indexOf(northSide) + 4) % 4;
  return ORDER[shift];
}

/** Xona uchastkaning qaysi chetlariga tegadi. */
export function edgesOf(room: Room, bounds: Rect): WallSide[] {
  const edges: WallSide[] = [];
  const { rect } = room;

  if (Math.abs(rect.y - bounds.y) < EDGE_TOLERANCE) edges.push('north');
  if (Math.abs(rect.x - bounds.x) < EDGE_TOLERANCE) edges.push('west');
  if (Math.abs(rect.x + rect.width - (bounds.x + bounds.width)) < EDGE_TOLERANCE) {
    edges.push('east');
  }
  if (Math.abs(rect.y + rect.length - (bounds.y + bounds.length)) < EDGE_TOLERANCE) {
    edges.push('south');
  }

  return edges;
}

/**
 * Uyning yo'nalish bo'yicha bali.
 *
 * Faqat afzalligi BELGILANGAN xonalar sanaladi. Afzalligi yo'q
 * xonalarni "to'g'ri" deb hisoblash ballni sun'iy ko'tarardi va
 * variantlarni ajratmay qo'yardi.
 *
 * Ichkaridagi xona (hech qaysi chetga tegmaydigan) ham sanalmaydi:
 * uning yo'nalishi yo'q va bu rejaning aybi emas.
 */
export function orientationOf(
  house: House,
  northSide: WallSide,
  rules: Record<string, RoomTypeRule>,
): OrientationResult {
  const notes: OrientationNote[] = [];

  for (const floor of house.floors) {
    for (const room of floor.rooms) {
      const preferred = rules[room.roomType]?.sunSides ?? [];
      if (preferred.length === 0) continue;

      const facing = edgesOf(room, house.bounds).map((edge) => toCompass(edge, northSide));
      if (facing.length === 0) continue;

      notes.push({
        roomId: room.id,
        roomType: room.roomType,
        facing,
        preferred,
        ok: facing.some((side) => preferred.includes(side)),
      });
    }
  }

  if (notes.length === 0) return { score: 100, notes: [] };

  const good = notes.filter((note) => note.ok).length;
  return { score: Math.round((good / notes.length) * 100), notes };
}
