import type { PriceBook } from './pricing';

/**
 * Byudjetdan boshlash.
 *
 * Hozirgi oqim: o'lcham → uy → smeta. Odamning savoli esa ko'pincha
 * teskari: "menda 800 mln so'm bor — nima qura olaman?". Bu modul shu
 * savolga javob beradi.
 *
 * Hisob TAXMINIY va shunday deb aytiladi. Aniq summa faqat butun uy
 * qurilgandan keyin ma'lum bo'ladi (`computeEstimate`), chunki u
 * devor uzunligi va deraza maydoniga bog'liq — ular esa rejaga
 * bog'liq. Bu yerdagi hisob esa 1 m² ning o'rtacha narxiga tayanadi.
 */

/**
 * 1 m² ning taxminiy narxi.
 *
 * Narx kitobidagi bandlarni bir marta hisoblab olamiz: har band
 * o'lchov birligiga bog'langan va ularni maydonga keltirish uchun
 * ETALON uy ishlatiladi. Etalon — kvadratga yaqin bir qavatli uy,
 * chunki uzun tor uyda devor ko'p va 1 m² qimmatroq tushadi.
 */
export interface SquareMetreCost {
  /** So'mda. */
  perSquareMetre: number;
  finishLevel: string;
}

/**
 * Etalon uy o'lchovlari — 100 m² ga keltirilgan.
 *
 * Bu sonlar `measure()` ning 10 × 10 m, 1 qavatli, 4 xonali uy uchun
 * bergan natijasiga yaqin. Ular aniq emas va aniq bo'lishi ham shart
 * emas: natija foydalanuvchiga "taxminiy" deb ko'rsatiladi.
 */
const REFERENCE = {
  FLOOR_AREA: 100,
  WALL_AREA: 260,
  EXTERIOR_WALL_AREA: 150,
  INTERIOR_WALL_AREA: 110,
  ROOF_AREA: 115,
  FOUNDATION_AREA: 100,
  WINDOW_AREA: 22,
  DOOR_COUNT: 8,
  ROOM_COUNT: 4,
  PERIMETER: 40,
  CEILING_AREA: 100,
  VOLUME: 280,
} as const;

/**
 * Narx kitobidan 1 m² narxini chiqaradi.
 *
 * Har band o'z o'lchoviga ko'paytiriladi va yig'indi etalon
 * maydonga bo'linadi.
 */
export function squareMetreCost(book: PriceBook): SquareMetreCost {
  let total = 0;

  for (const line of book.lines) {
    const quantity = REFERENCE[line.measure as keyof typeof REFERENCE];
    if (typeof quantity !== 'number') continue;

    total += line.unitPrice * quantity;
  }

  return {
    perSquareMetre: Math.round(total / REFERENCE.FLOOR_AREA),
    finishLevel: book.finishLevel,
  };
}

export interface BudgetInput {
  /** So'mda. */
  budget: number;
  /** Yer maydoni — sotixda. */
  landAreaSotix: number;
  floors: number;
  book: PriceBook;
}

export interface BudgetSuggestion {
  /** Sig'adigan qurilish maydoni, m². */
  buildableArea: number;
  /** Bitta qavat o'lchamlari. */
  width: number;
  length: number;
  floors: number;
  /** Necha xona sig'adi — taxminan. */
  rooms: number;
  perSquareMetre: number;
  /** Taxminiy summa — tanlangan o'lchamga. */
  estimated: number;
  /** Byudjet yetmasa `true`: eng kichik uy ham qimmat. */
  tooSmall: boolean;
}

/** Yerning nechchi foizigacha qurish mumkin — `MAX_FOOTPRINT_SHARE`. */
const MAX_FOOTPRINT_SHARE = 0.6;

/** Bundan kichik uy ma'nosiz. */
const MIN_SIDE = 6;

/** Bitta xonaga o'rtacha necha m². */
const AREA_PER_ROOM = 18;

/**
 * Byudjetga mos uy o'lchamini taklif qiladi.
 *
 * Tomon nisbati 1.25 ga yaqin olinadi: aniq kvadrat uy kamdan-kam
 * quriladi, juda cho'ziq uyda esa devor ko'payib, 1 m² qimmatlashadi.
 */
export function suggestFromBudget(input: BudgetInput): BudgetSuggestion {
  const { perSquareMetre } = squareMetreCost(input.book);
  const floors = Math.max(1, Math.min(3, Math.round(input.floors)));

  const affordable = perSquareMetre > 0 ? input.budget / perSquareMetre : 0;

  // Yerga sig'adigan eng katta qurilish maydoni.
  const landLimit = input.landAreaSotix * 100 * MAX_FOOTPRINT_SHARE * floors;
  const buildable = Math.min(affordable, landLimit);

  const perFloor = buildable / floors;
  const side = Math.sqrt(perFloor / 1.25);

  /*
    Pastga yaxlitlanadi.

    Yuqoriga yaxlitlansa taklif qilingan uy byudjetdan OSHIB ketardi:
    800 mln uchun 17 × 14 m taklif qilinib, uning narxi 834 mln
    chiqardi va ekranda "byudjet yetmaydi" ogohlantirishi bilan birga
    ko'rinardi. Bu bir-biriga zid ikki xabar edi.
  */
  const width = Math.max(MIN_SIDE, Math.floor(side * 1.25));
  const length = Math.max(MIN_SIDE, Math.floor(side));

  const area = width * length * floors;

  return {
    buildableArea: Math.round(area),
    width,
    length,
    floors,
    rooms: Math.max(2, Math.round(area / AREA_PER_ROOM)),
    perSquareMetre,
    estimated: Math.round(area * perSquareMetre),
    /*
      Eng KICHIK uy ham byudjetdan qimmat bo'lsa buni aytish kerak.

      Taqqoslash aynan minimal uy bilan bo'ladi, taklif qilingani
      bilan emas: taklif byudjetga moslab tanlanadi va u bilan
      solishtirish har doim "yetadi" deb chiqardi yoki, yuqoriga
      yaxlitlash tufayli, "yetmaydi" deb yolg'on gapirardi.
    */
    tooSmall: MIN_SIDE * MIN_SIDE * floors * perSquareMetre > input.budget,
  };
}
