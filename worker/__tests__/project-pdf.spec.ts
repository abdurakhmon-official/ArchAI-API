import { renderProjectPdf, type PdfInput } from '@/worker/templates/project-pdf';
import type { EstimateResult } from '@/services/estimate.service';

/**
 * Kategoriyalar shu yerda satr sifatida yoziladi, `generated/prisma` dan
 * import qilinmaydi: Prisma klienti juda katta va uni test jarayoniga
 * tortib kelish butun to'plamni xotiradan chiqarib yuborardi. Shablon
 * kategoriyani baribir kalit sifatida ishlatadi.
 */
const PRICE_CATEGORY = {
  FOUNDATION: 'FOUNDATION',
  WALLS: 'WALLS',
} as const;

/**
 * PDF shabloni sof funksiya — brauzersiz test qilinadi.
 *
 * Bu yerda tekshiriladigan narsa "chiroyli chiqdimi" emas: HTML to'g'ri
 * o'ralganmi, ma'lumot to'liq tushganmi va foydalanuvchi matni to'g'ri
 * ekranlanganmi. Ko'rinishni faqat ko'z bilan baholash mumkin.
 */

const estimate = {
  lines: [
    {
      code: 'foundation_strip',
      category: PRICE_CATEGORY.FOUNDATION,
      name: { uz: 'Lentali poydevor' },
      unit: 'm³',
      quantity: 18.4,
      unitPrice: 1_450_000,
      total: 26_680_000,
    },
    {
      code: 'wall_exterior',
      category: PRICE_CATEGORY.WALLS,
      name: { uz: 'Tashqi devor' },
      unit: 'm²',
      quantity: 120,
      unitPrice: 620_000,
      total: 74_400_000,
    },
  ],
  categories: [
    { category: PRICE_CATEGORY.WALLS, total: 74_400_000, share: 0.73 },
    { category: PRICE_CATEGORY.FOUNDATION, total: 26_680_000, share: 0.27 },
  ],
  measurements: {
    PERIMETER: 46,
    FLOOR_AREA: 132,
    EXTERIOR_WALL_AREA: 120,
    INTERIOR_WALL_AREA: 88,
    WALL_AREA: 208,
    ROOF_AREA: 164,
    FOUNDATION_VOLUME: 18.4,
    CEILING_AREA: 132,
    WINDOW_COUNT: 6,
    DOOR_COUNT: 7,
    WINDOW_AREA: 14.2,
    FLOOR_COUNT: 1,
    ROOM_COUNT: 6,
    GARAGE_AREA: 21.6,
    TERRACE_AREA: 18,
    BALCONY_AREA: 0,
    BASEMENT_AREA: 0,
    SAUNA_AREA: 0,
    POOL_AREA: 0,
  },
  subtotal: 101_080_000,
  contingency: 7_075_600,
  total: 108_155_600,
  perSquareMeter: 819_360,
  currency: 'UZS',
  finishLevel: 'standard',
  disclaimer: 'Bu taxminiy hisob-kitob, yakuniy narx emas.',
} as unknown as EstimateResult;

const base: PdfInput = {
  locale: 'uz',
  title: 'Namuna uy',
  note: 'Sinov uchun izoh',
  styleName: 'Classic',
  finishName: 'O\'rta',
  floors: [
    {
      level: 1,
      svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"><rect width="10" height="10"/></svg>',
      rooms: [
        { roomType: 'living', area: 32.5 },
        { roomType: 'bedroom', area: 18.1 },
        { roomType: 'bathroom', area: 7.4 },
      ],
    },
  ],
  estimate,
  names: { living: 'Mehmonxona', bedroom: 'Yotoqxona', bathroom: 'Sanuzel' },
  watermark: false,
  generatedAt: new Date('2026-08-16T10:00:00Z'),
};

const render = (overrides: Partial<PdfInput> = {}) => renderProjectPdf({ ...base, ...overrides });

describe('PDF template', () => {
  const html = render();

  describe('document structure', () => {
    it('returns a valid HTML document', () => {
      expect(html.startsWith('<!doctype html>')).toBe(true);
      expect(html.trimEnd().endsWith('</html>')).toBe(true);
    });

    it('sets the A4 page size', () => {
      expect(html).toContain('@page');
      expect(html).toContain('size: A4');
    });

    it('a separate page for each floor', () => {
      const twoFloors = render({
        floors: [base.floors[0], { ...base.floors[0], level: 2 }],
      });

      // Muqova + 2 qavat + smeta = 4 sahifa.
      expect(count(twoFloors, '<section class="page">')).toBe(4);
      expect(twoFloors).toContain('2. qavat rejasi');
    });
  });

  describe('data completeness', () => {
    it('renders the title and the note', () => {
      expect(html).toContain('Namuna uy');
      expect(html).toContain('Sinov uchun izoh');
    });

    it('places without changing the drawing', () => {
      expect(html).toContain(base.floors[0].svg);
    });

    it('takes the room names from the dictionary', () => {
      expect(html).toContain('Mehmonxona');
      expect(html).toContain('Yotoqxona');
      expect(html).not.toContain('>living<');
    });

    it('groups estimate lines by category', () => {
      expect(html).toContain('Poydevor');
      expect(html).toContain('Devorlar');
      expect(html).toContain('Lentali poydevor');
    });

    it('shows the contingency and the total', () => {
      expect(html).toContain('Kutilmagan xarajatlar (7%)');
      expect(html).toContain('JAMI');
    });

    it('always adds the warning', () => {
      expect(html).toContain('Bu taxminiy hisob-kitob, yakuniy narx emas.');
    });

    it('writes the finish level', () => {
      expect(html).toContain('O&#039;rta'.replace('&#039;', "'"));
    });

    it('writes nothing about the region', () => {
      // Hudud koeffitsienti olib tashlandi: material varianti va
      // foydalanuvchining o'z narxi undan aniqroq.
      expect(html).not.toContain('Hudud');
      expect(html).not.toContain('Toshkent');
    });
  });

  describe('extra volumes', () => {
    it('shows the ones that exist', () => {
      expect(html).toContain('Garaj');
      expect(html).toContain('Terrassa');
    });

    it('hides the ones equal to zero', () => {
      expect(html).not.toContain('Balkon');
      expect(html).not.toContain('Yerto');
    });
  });

  describe('watermark', () => {
    it('is applied on the free plan', () => {
      expect(render({ watermark: true })).toContain('body::before');
    });

    it('is not applied on a paid plan', () => {
      expect(html).not.toContain('body::before');
    });
  });

  describe('safety', () => {
    it('escapes tags in user text', () => {
      const risky = render({
        title: '<script>alert(1)</script>',
        note: 'A & B "test"',
      });

      expect(risky).not.toContain('<script>alert(1)</script>');
      expect(risky).toContain('&lt;script&gt;');
      expect(risky).toContain('A &amp; B &quot;test&quot;');
    });

    it('leaves no empty paragraph when there is no note', () => {
      expect(render({ note: null })).not.toContain('Sinov uchun izoh');
    });
  });

  it('holds on a floor with no rooms', () => {
    const empty = render({ floors: [{ level: 1, svg: '<svg/>', rooms: [] }] });

    expect(empty).toContain('1. qavat rejasi');
    expect(empty).toContain('100%');
  });
});

function count(text: string, needle: string): number {
  return text.split(needle).length - 1;
}

describe('the user selection in the document', () => {
  /**
   * Faza 4 ning asosiy va'dasi: PDF pudratchiga ko'rsatish uchun
   * yaroqli bo'lsin. Buning uchun raqamdan tashqari uning MANBASI ham
   * ko'rinishi kerak — qaysi material tanlangani, qaysi narx
   * foydalanuvchining o'zidan kelgani.
   */
  const chosen = {
    ...estimate,
    confidence: 0.5,
    lines: [
      { ...estimate.lines[0], source: 'user' },
      { ...estimate.lines[1], source: 'option', optionCode: 'gazoblok' },
    ],
  } as unknown as EstimateResult;

  const html = render({
    estimate: chosen,
    optionNames: { wall_exterior: { gazoblok: 'Gazoblok' } },
  });

  it('writes the name of the chosen material', () => {
    expect(html).toContain('Gazoblok');
  });

  it('marks a user price separately', () => {
    expect(html).toContain('o\'z narxingiz');
  });

  it('shows the confidence level', () => {
    expect(html).toContain('qisman aniq (50%)');
  });

  it('never calls a fully exact estimate "approximate"', () => {
    const exact = render({ estimate: { ...chosen, confidence: 1 } as EstimateResult });

    expect(exact).toContain('Aniqligi: <strong>aniq</strong>');
    expect(exact).not.toContain('<h2>Taxminiy smeta</h2>');
  });

  it('adds nothing when there is no selection', () => {
    const plain = render();

    expect(plain).not.toContain('o\'z narxingiz');
    expect(plain).toContain('<h2>Taxminiy smeta</h2>');
  });

  it('a material with no name falls back to its code', () => {
    // Admin materialni o'chirgan bo'lishi mumkin — hujjat baribir
    // to'liq chiqishi kerak, band yo'qolib qolmasligi kerak.
    const orphan = render({ estimate: chosen, optionNames: {} });

    expect(orphan).toContain('(gazoblok)');
  });
});

describe('estimate order and contingency share', () => {
  it('sorts categories by share', () => {
    // `lines` da poydevor birinchi, lekin `categories` da devorlar
    // yuqorida — hujjat aynan shu tartibga bo'ysunishi kerak.
    //
    // Faqat guruh sarlavhalari solishtiriladi: "Poydevor" so'zi
    // hujjatning boshqa joyida ham uchraydi va butun HTML bo'yicha
    // qidirish noto'g'ri javob berardi.
    const groups = [...render().matchAll(/<tr class="group">\s*<td colspan="3">([^<]+)</g)].map(
      (match) => match[1],
    );

    expect(groups).toEqual(['Devorlar', 'Poydevor']);
  });

  it('computes the contingency share from the estimate', () => {
    expect(render()).toContain('Kutilmagan xarajatlar (7%)');
  });

  it('writes correctly at another share too', () => {
    // Qattiq yozilgan "7%" shu testda yiqilardi.
    const other = {
      ...estimate,
      subtotal: 100_000_000,
      contingency: 12_000_000,
    } as unknown as EstimateResult;

    expect(render({ estimate: other })).toContain('Kutilmagan xarajatlar (12%)');
  });

  it('also renders a category missing from `categories`', () => {
    const extra = {
      ...estimate,
      lines: [...estimate.lines, { ...estimate.lines[0], code: 'roof_x', category: 'ROOF' }],
    } as unknown as EstimateResult;

    expect(render({ estimate: extra })).toContain('Tom');
  });
});
