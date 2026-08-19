import { isMeasureKey, measure } from '../geometry/measure';
import { round } from '../geometry/tree';
import type { House, Measurements } from '../geometry/types';

export type PriceCategory =
  | 'FOUNDATION'
  | 'WALLS'
  | 'ROOF'
  | 'WINDOWS_DOORS'
  | 'FINISHING'
  | 'UTILITIES'
  | 'OTHER';

export interface PriceOptionLine {
  code: string;
  name: unknown;
  description: unknown;
  unitPrice: number;
  imageUrl: string | null;
  sort: number;
}

export interface PriceLine {
  code: string;
  category: PriceCategory;
  name: unknown;
  unit: string;
  unitPrice: number;
  measure: string;
  sort: number;
  options: PriceOptionLine[];
}

export interface PriceBook {
  lines: PriceLine[];
  finishDefaults: Record<string, string>;
  finishLevel: string;
}

const CONTINGENCY = 0.07;

export interface LineSelection {
  optionCode?: string;
  unitPrice?: number;
  excluded?: boolean;
  note?: string;
}

export type EstimateSelection = Record<string, LineSelection>;

export type PriceSource = 'user' | 'option' | 'finish' | 'base';

export interface EstimateLine {
  code: string;
  category: PriceCategory;
  name: unknown;
  unit: string;
  quantity: number;
  unitPrice: number;
  total: number;
  optionCode?: string;
  source: PriceSource;
}

export interface EstimateResult {
  lines: EstimateLine[];
  categories: Array<{ category: PriceCategory; total: number; share: number }>;
  measurements: Measurements;
  subtotal: number;
  contingency: number;
  total: number;
  perSquareMeter: number;
  currency: 'UZS';
  finishLevel: string;
  warnings: string[];
  confidence: number;
  disclaimer: string;
}

/** Translation code. Both the screen and the PDF render it themselves. */
const DISCLAIMER = 'ESTIMATE_DISCLAIMER';

function resolvePrice(
  line: PriceBook['lines'][number],
  choice: LineSelection,
  finishDefaults: Record<string, string>,
): { unitPrice: number; source: PriceSource; optionCode?: string } {
  if (typeof choice.unitPrice === 'number' && choice.unitPrice >= 0) {
    return { unitPrice: choice.unitPrice, source: 'user', optionCode: choice.optionCode };
  }

  if (choice.optionCode) {
    const option = line.options.find((item) => item.code === choice.optionCode);
    if (option) return { unitPrice: option.unitPrice, source: 'option', optionCode: option.code };
  }

  const preset = finishDefaults[line.code];
  if (preset) {
    const option = line.options.find((item) => item.code === preset);
    if (option) return { unitPrice: option.unitPrice, source: 'finish', optionCode: option.code };
  }

  return { unitPrice: line.unitPrice, source: 'base' };
}

function confidenceOf(considered: number, confirmed: number): number {
  return considered === 0 ? 1 : round(confirmed / considered, 3);
}

export function computeEstimate(
  house: House,
  book: PriceBook,
  selection: EstimateSelection = {},
): EstimateResult {
  return estimateFrom(measure(house), book, selection);
}


export function estimateFrom(
  measurements: Measurements,
  book: PriceBook,
  selection: EstimateSelection = {},
): EstimateResult {
  const lines: EstimateLine[] = [];
  const warnings: string[] = [];

  let confirmed = 0;
  let excluded = 0;

  for (const line of book.lines) {

    if (!isMeasureKey(line.measure)) {
      const problem = `price item "${line.code}" is bound to an unknown measure: "${line.measure}"`;
      warnings.push(problem);
      console.warn('PRICE_ITEM_BAD_MEASURE:', problem);
      continue;
    }

    const quantity = measurements[line.measure];

    if (quantity <= 0) continue;

    const choice = selection[line.code] ?? {};

    if (choice.excluded) {
      confirmed += 1;
      excluded += 1;
      continue;
    }

    const resolved = resolvePrice(line, choice, book.finishDefaults);
    if (resolved.source === 'user' || resolved.source === 'option') confirmed += 1;

    const unitPrice = resolved.unitPrice;

    lines.push({
      code: line.code,
      category: line.category,
      name: line.name,
      unit: line.unit,
      quantity: round(quantity),
      unitPrice: round(unitPrice),
      total: round(quantity * unitPrice),
      ...(resolved.optionCode ? { optionCode: resolved.optionCode } : {}),
      source: resolved.source,
    });
  }

  const subtotal = round(lines.reduce((sum, line) => sum + line.total, 0));
  const contingency = round(subtotal * CONTINGENCY);
  const total = round(subtotal + contingency);

  const byCategory = new Map<PriceCategory, number>();
  for (const line of lines) {
    byCategory.set(line.category, round((byCategory.get(line.category) ?? 0) + line.total));
  }

  const categories = [...byCategory.entries()]
    .map(([category, categoryTotal]) => ({
      category,
      total: categoryTotal,
      share: subtotal === 0 ? 0 : round(categoryTotal / subtotal, 4),
    }))
    .sort((first, second) => second.total - first.total);

  return {
    lines,
    categories,
    measurements,
    subtotal,
    contingency,
    total,
    perSquareMeter: measurements.FLOOR_AREA === 0 ? 0 : round(total / measurements.FLOOR_AREA),
    currency: 'UZS',
    finishLevel: book.finishLevel,
    warnings,
    confidence: confidenceOf(lines.length + excluded, confirmed),
    disclaimer: DISCLAIMER,
  };
}
