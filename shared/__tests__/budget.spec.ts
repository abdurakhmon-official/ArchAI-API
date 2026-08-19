import { squareMetreCost, suggestFromBudget } from '../budget';
import type { PriceBook } from '../pricing';

/**
 * Byudjetdan boshlash.
 *
 * Kodda byudjet tushunchasi UMUMAN yo'q edi: oqim faqat bir tomonga
 * — o'lcham → uy → smeta — ishlardi. Odamning savoli esa ko'pincha
 * teskari.
 */

const book: PriceBook = {
  finishLevel: 'standard',
  finishDefaults: {},
  lines: [
    { code: 'foundation', category: 'BASE', name: {}, unit: 'm²', unitPrice: 1_000_000, measure: 'FOUNDATION_AREA', sort: 1, options: [] },
    { code: 'walls', category: 'WALLS', name: {}, unit: 'm²', unitPrice: 300_000, measure: 'WALL_AREA', sort: 2, options: [] },
    { code: 'roof', category: 'ROOF', name: {}, unit: 'm²', unitPrice: 400_000, measure: 'ROOF_AREA', sort: 3, options: [] },
    // Noma'lum o'lchov — hisobga olinmasligi kerak, yiqilmasligi ham.
    { code: 'noma-lum', category: 'OTHER', name: {}, unit: 'x', unitPrice: 999, measure: 'YOQ_BUNDAY', sort: 4, options: [] },
  ] as PriceBook['lines'],
};

describe('price per m²', () => {
  it('multiplies the lines by the reference house', () => {
    // 1_000_000×100 + 300_000×260 + 400_000×115 = 224_000_000 → /100
    expect(squareMetreCost(book).perSquareMetre).toBe(2_240_000);
  });

  it('an unknown measure does not bring it down', () => {
    expect(Number.isFinite(squareMetreCost(book).perSquareMetre)).toBe(true);
  });
});

describe('suggestion from a budget', () => {
  const base = { landAreaSotix: 10, floors: 1, book };

  it('a bigger budget gives a bigger house', () => {
    const small = suggestFromBudget({ ...base, budget: 300_000_000 });
    const large = suggestFromBudget({ ...base, budget: 900_000_000 });

    expect(large.buildableArea).toBeGreaterThan(small.buildableArea);
  });

  it('the estimate never EXCEEDS the budget', () => {
    /*
      Ilgari o'lcham yuqoriga yaxlitlanardi va taklif byudjetdan
      oshib ketardi: 800 mln uchun 17 × 14 m taklif qilinib, narxi
      834 mln chiqardi. Sinov 15% yon berish bilan buni ushlamasdi.
    */
    for (const budget of [300_000_000, 500_000_000, 800_000_000, 1_500_000_000]) {
      const result = suggestFromBudget({ ...base, budget });
      expect(result.estimated).toBeLessThanOrEqual(budget);
    }
  });

  it('the suggestion and the warning do not contradict each other', () => {
    // Yetarli byudjetda ogohlantirish bo'lmasligi kerak.
    const result = suggestFromBudget({ ...base, budget: 800_000_000 });
    expect(result.tooSmall).toBe(false);
    expect(result.estimated).toBeLessThanOrEqual(800_000_000);
  });

  it('the plot boundary is respected', () => {
    /*
      Cheksiz pul ham yerga sig'maydigan uy qurishga imkon
      bermasligi kerak: `MAX_FOOTPRINT_SHARE` — 60%.
    */
    const result = suggestFromBudget({ ...base, landAreaSotix: 3, budget: 10_000_000_000 });

    expect(result.buildableArea).toBeLessThanOrEqual(3 * 100 * 0.6 + 20);
  });

  it('the floor count splits the area', () => {
    const one = suggestFromBudget({ ...base, budget: 800_000_000, floors: 1 });
    const two = suggestFromBudget({ ...base, budget: 800_000_000, floors: 2 });

    // Bir xil byudjetda umumiy maydon yaqin, lekin qavat izi kichik.
    expect(two.width * two.length).toBeLessThan(one.width * one.length);
  });

  it('a small budget is stated plainly', () => {
    /*
      Eng kichik uy ham qimmat bo'lsa buni aytish kerak — aks holda
      foydalanuvchi 6 × 6 m taklifini ko'rib, narxi ikki baravar
      ekanini keyin bilardi.
    */
    const result = suggestFromBudget({ ...base, budget: 10_000_000 });

    expect(result.tooSmall).toBe(true);
    expect(result.width).toBeGreaterThanOrEqual(6);
  });

  it('no warning on a sufficient budget', () => {
    expect(suggestFromBudget({ ...base, budget: 800_000_000 }).tooSmall).toBe(false);
  });

  it('the room count matches the area', () => {
    const result = suggestFromBudget({ ...base, budget: 800_000_000 });
    expect(result.rooms).toBeGreaterThanOrEqual(2);
    expect(result.rooms).toBeLessThan(result.buildableArea);
  });
});
