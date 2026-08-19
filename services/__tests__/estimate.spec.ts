import { PRICE_CATEGORY } from '../../generated/prisma';
import { buildHouse } from '../../geometry/layout';
import { MEASURE_KEYS, isMeasureKey } from '../../geometry/measure';
import type { Measurements } from '../../geometry/types';
import { BOUNDS, OPTIONS, sampleTree } from '../../geometry/__tests__/fixtures';
import { computeEstimate, estimateFrom } from '../../shared/pricing';
import type { PriceBook, PriceLine, PriceOptionLine } from '../../shared/pricing';

/**
 * Smeta hisobi.
 *
 * Asosiy e'tibor bitta xatti-harakatga: narx bandi noto'g'ri o'lchovga
 * bog'langanda u JIMGINA yo'qolmasligi kerak. Ilgari shunday edi va
 * bazadagi bitta harf xatosi butun bandni smetadan olib tashlardi.
 */

const house = buildHouse(
  { bounds: BOUNDS, floors: [{ level: 1, tree: sampleTree() }] },
  OPTIONS,
).house;

const option = (code: string, unitPrice: number): PriceOptionLine => ({
  code,
  name: { uz: code },
  description: null,
  unitPrice,
  imageUrl: null,
  sort: 1,
});

const line = (over: Partial<PriceLine> = {}): PriceLine => ({
  code: 'wall_exterior',
  category: PRICE_CATEGORY.WALLS,
  name: { uz: 'Tashqi devor' },
  unit: 'm²',
  unitPrice: 600_000,
  measure: 'EXTERIOR_WALL_AREA',
  sort: 1,
  options: [],
  ...over,
});

const book = (lines: PriceLine[], finishDefaults: Record<string, string> = {}): PriceBook => ({
  lines,
  finishDefaults,
  finishLevel: 'standard',
});

/** Bitta bandli smetadagi birlik narxi — ko'p testda shu kerak. */
const priceOf = (result: ReturnType<typeof computeEstimate>) => result.lines[0]?.unitPrice;

describe('the list of measure keys', () => {
  it('covers every key in `Measurements`', () => {
    // Uy haqiqiy o'lchovlar beradi — ro'yxat o'shalar bilan solishtiriladi.
    const measured = Object.keys(computeEstimate(house, book([])).measurements);

    expect([...MEASURE_KEYS].sort()).toEqual(measured.sort());
  });

  it('rejects an unknown key', () => {
    expect(isMeasureKey('FLOOR_AREA')).toBe(true);
    expect(isMeasureKey('FLOOR_AREAA')).toBe(false);
    expect(isMeasureKey('')).toBe(false);
  });
});

describe('a line bound to an invalid measure', () => {
  it('stays out of the total but raises a warning', () => {
    const result = computeEstimate(house, book([line({ measure: 'FLOOR_AREAA' })]));

    expect(result.lines).toHaveLength(0);
    expect(result.warnings).toHaveLength(1);
    expect(result.warnings[0]).toContain('wall_exterior');
    expect(result.warnings[0]).toContain('FLOOR_AREAA');
  });

  it('does not disturb the valid lines', () => {
    const result = computeEstimate(
      house,
      book([line(), line({ code: 'buzuq', measure: 'YOQ_BUNDAY' })]),
    );

    expect(result.lines.map((item) => item.code)).toEqual(['wall_exterior']);
    expect(result.warnings).toHaveLength(1);
    expect(result.subtotal).toBeGreaterThan(0);
  });
});

describe('zero quantity', () => {
  it('raises no warning — this is normal', () => {
    // Garaj so'ralmagan, ya'ni `GARAGE_AREA` nol. Bu xato emas.
    const result = computeEstimate(
      house,
      book([line({ code: 'garage_build', measure: 'GARAGE_AREA' })]),
    );

    expect(house.extras).toHaveLength(0);
    expect(result.lines).toHaveLength(0);
    expect(result.warnings).toHaveLength(0);
  });
});

describe('counting', () => {
  it('the contingency is taken from the subtotal', () => {
    const result = computeEstimate(house, book([line()]));

    expect(result.contingency).toBeCloseTo(result.subtotal * 0.07, 1);
    expect(result.total).toBeCloseTo(result.subtotal + result.contingency, 1);
  });

  it('the category shares sum to one', () => {
    const result = computeEstimate(
      house,
      book([
        line(),
        line({ code: 'roof_cover', category: PRICE_CATEGORY.ROOF, measure: 'ROOF_AREA' }),
        line({ code: 'floor_finish', category: PRICE_CATEGORY.FINISHING, measure: 'FLOOR_AREA' }),
      ]),
    );

    const sum = result.categories.reduce((total, item) => total + item.share, 0);
    expect(sum).toBeCloseTo(1, 3);
  });

  it('the price per m² is the total divided by the floor area', () => {
    const result = computeEstimate(house, book([line()]));
    const floorArea = (result.measurements as Measurements).FLOOR_AREA;

    expect(result.perSquareMeter).toBeCloseTo(result.total / floorArea, 1);
  });
});

describe('where the price comes from', () => {
  const withOptions = () =>
    line({
      unitPrice: 600_000,
      options: [option('gazoblok', 480_000), option('gisht', 620_000)],
    });

  it('the fallback price is used when no material is chosen', () => {
    const result = computeEstimate(house, book([withOptions()]));

    expect(priceOf(result)).toBe(600_000);
    expect(result.lines[0].source).toBe('base');
  });

  it('the finish set picks the material', () => {
    const result = computeEstimate(
      house,
      book([withOptions()], { wall_exterior: 'gazoblok' }),
    );

    expect(priceOf(result)).toBe(480_000);
    expect(result.lines[0].source).toBe('finish');
    expect(result.lines[0].optionCode).toBe('gazoblok');
  });

  it('the user selection beats the finish set', () => {
    const result = computeEstimate(
      house,
      book([withOptions()], { wall_exterior: 'gazoblok' }),
      { wall_exterior: { optionCode: 'gisht' } },
    );

    expect(priceOf(result)).toBe(620_000);
    expect(result.lines[0].source).toBe('option');
  });

  it('a hand-entered price beats everything', () => {
    const result = computeEstimate(
      house,
      book([withOptions()], { wall_exterior: 'gazoblok' }),
      { wall_exterior: { optionCode: 'gisht', unitPrice: 111_000 } },
    );

    expect(priceOf(result)).toBe(111_000);
    expect(result.lines[0].source).toBe('user');
  });

  it('falls back for a material that does not exist', () => {
    // Admin materialni o'chirgan bo'lishi mumkin — smeta buzilmasin.
    const result = computeEstimate(
      house,
      book([withOptions()], { wall_exterior: 'gazoblok' }),
      { wall_exterior: { optionCode: 'yoq_bunday' } },
    );

    expect(priceOf(result)).toBe(480_000);
    expect(result.lines[0].source).toBe('finish');
  });

  it('an excluded line stays out of the estimate', () => {
    const result = computeEstimate(house, book([withOptions()]), {
      wall_exterior: { excluded: true },
    });

    expect(result.lines).toHaveLength(0);
    expect(result.subtotal).toBe(0);
  });
});

describe('confidence measure', () => {
  const two = () => [
    line({ options: [option('gisht', 620_000)] }),
    line({ code: 'roof_cover', measure: 'ROOF_AREA', options: [option('profnastil', 380_000)] }),
  ];

  it('zero when nothing is selected', () => {
    expect(computeEstimate(house, book(two())).confidence).toBe(0);
  });

  it('half when half is selected', () => {
    const result = computeEstimate(house, book(two()), {
      wall_exterior: { optionCode: 'gisht' },
    });

    expect(result.confidence).toBeCloseTo(0.5, 2);
  });

  it('one when everything is selected', () => {
    const result = computeEstimate(house, book(two()), {
      wall_exterior: { optionCode: 'gisht' },
      roof_cover: { unitPrice: 400_000 },
    });

    expect(result.confidence).toBe(1);
  });

  it('a finish set does not count as confidence', () => {
    // To'plam — bu adminning taxmini, foydalanuvchining tasdig'i emas.
    const result = computeEstimate(house, book(two(), { wall_exterior: 'gisht' }));

    expect(result.confidence).toBe(0);
  });
});

describe('computing from measurements', () => {
  /**
   * `estimateFrom` — brauzer ishlatadigan yo'l.
   *
   * Foydalanuvchi material tanlaganda summa darhol yangilanishi kerak,
   * lekin brauzerda `House` yo'q — faqat saqlangan smetadagi o'lchovlar
   * bor. Ikki yo'l ajralib ketsa ekrandagi raqam serverdagidan farq
   * qiladi va buni hech kim sezmaydi, shuning uchun test aynan shuni
   * qo'riqlaydi.
   */
  const lines = [
    line({ options: [option('gisht', 620_000), option('gazoblok', 480_000)] }),
    line({ code: 'roof_cover', category: PRICE_CATEGORY.ROOF, measure: 'ROOF_AREA' }),
  ];

  it('gives the same result as computing from the house', () => {
    const selection = {
      wall_exterior: { optionCode: 'gazoblok' },
      roof_cover: { unitPrice: 415_000 },
    };

    const fromHouse = computeEstimate(house, book(lines), selection);
    const fromMeasurements = estimateFrom(fromHouse.measurements, book(lines), selection);

    expect(fromMeasurements).toEqual(fromHouse);
  });

  it('the same without a selection', () => {
    const fromHouse = computeEstimate(house, book(lines, { wall_exterior: 'gisht' }));

    expect(estimateFrom(fromHouse.measurements, book(lines, { wall_exterior: 'gisht' }))).toEqual(
      fromHouse,
    );
  });
});
