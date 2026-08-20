import { ensureCirculation } from '../geometry/corridor';
import { drawFloor, toSvg } from '../geometry/drawing';
import { requestsFrom, type ExtraRequest } from '../geometry/extras';
import { buildHouse, pickStairs } from '../geometry/layout';
import { applyRoomProgram, type SkippedRoom } from '../geometry/program';
import { fitAndRebalance } from '../geometry/resize';
import { GeometryError } from '../geometry/split';
import { orientationOf, type OrientationNote } from '../geometry/orientation';
import { validateHouse } from '../geometry/validate';
import type {
  Issue,
  LayoutRules,
  Measurements,
  Rect,
  RoofSpec,
  RoomTypeRule,
  TreeNode,
  WallSide,
} from '../geometry/types';
import { hashOf } from './hash';
import { computeEstimate, type PriceBook } from './pricing';

export const MAX_COMBINATIONS = 12;
export const MIN_ACCEPTABLE_SCORE = 45;

export interface StyleConfig {
  id: string;
  slug: string;
  roof: RoofSpec;
  layout: LayoutRules;
  facade: Record<string, unknown>;
  window: Record<string, unknown>;
  interior: Record<string, unknown>;
}

export interface SkeletonCandidate {
  id: string;
  name: string;
  floors: number;
  trees: TreeNode[];
  fit: number;
}

export interface SkeletonRow {
  id: string;
  name: string;
  floors: number;
  tree: unknown;
  tagBedrooms: number[];
  tagStyles: string[];
  minWidth: number;
  maxWidth: number;
  minLength: number;
  maxLength: number;
}

export interface CandidateQuery {
  floors: number;
  bedrooms: number;
  width: number;
  length: number;
  styleSlug?: string;
}

export interface GenerateParams {
  width: number;
  length: number;
  floors: number;
  rooms: Record<string, number>;
  garage: number;
  extras: string[];
  variants: number;
  styleSlug?: string;
  /**
   * Chizmaning qaysi cheti shimolga qaraydi.
   *
   * Berilmasa yo'nalish hisobga olinmaydi — eski manzillar
   * ishlayverishi kerak.
   */
  northSide?: WallSide;
}

export interface VariantFloor {
  level: number;
  tree: TreeNode;
  rooms: Array<{ id: string; roomType: string; area: number; ratio: number }>;
}

export interface Variant {
  id: string;
  skeletonId: string;
  skeletonName: string;
  styleSlug: string;
  geometry: {
    bounds: Rect;
    floors: Array<{ level: number; tree: TreeNode }>;
    styleSlug: string;
    extras: ExtraRequest[];
  };
  floors: VariantFloor[];
  score: number;
  issues: Issue[];
  measurements: Measurements;
  estimateTotal: number;
  perSquareMeter: number;
  coverSvg: string;
  extras: Array<{ kind: string; area: number; side: string | null }>;
  skippedExtras: Array<{ kind: string; reason: string }>;
  steps: {
    corridorsAdded: number;
    rebalanced: boolean;
    roomsAdded: number;
    roomsRemoved: number;
    /** So'ralgan, lekin sig'magan xonalar. Bo'sh bo'lsa hammasi joylashgan. */
    skipped: SkippedRoom[];
  };
  /**
   * Ball nimadan tuzilgani.
   *
   * Foydalanuvchi «72/100» ni ko'radi va nima uchunligini bilmaydi.
   * Bu maydon shu savolga javob beradi: rejaning o'z bali, andozaning
   * mosligi va nechta muammo topilgani.
   */
  scoreParts: {
    /** Reja tekshiruvidan kelgan ball (`validateHouse`). */
    plan: number;
    /** Andoza so'rovga qanchalik mos (`rankCandidates`). */
    fit: number;
    errors: number;
    warnings: number;
    /** Yo'nalish bali. Yo'nalish berilmagan bo'lsa `null`. */
    orientation: number | null;
  };
  /** Qaysi xona qaysi tomonga qaragani. Yo'nalish berilmasa bo'sh. */
  orientation: OrientationNote[];
}

export interface GenerationResult {
  variants: Variant[];
  relaxed: boolean;
  /** Translation code — the screen renders it, this file never writes prose. */
  message?: string;
  messageValues?: Record<string, string | number>;
}

export function extractTrees(stored: unknown): TreeNode[] {
  const container = stored as { floors?: Array<{ level: number; tree: TreeNode }> } | null;
  if (!container?.floors) return [];

  return [...container.floors]
    .sort((first, second) => first.level - second.level)
    .map((floor) => floor.tree);
}

export function rankCandidates(rows: SkeletonRow[], query: CandidateQuery): SkeletonCandidate[] {
  return rows
    .map((row) => {
      const trees = extractTrees(row.tree);
      if (trees.length !== row.floors) return null;

      let fit = 100;

      if (row.tagBedrooms.length > 0 && !row.tagBedrooms.includes(query.bedrooms)) {
        const closest = Math.min(
          ...row.tagBedrooms.map((count) => Math.abs(count - query.bedrooms)),
        );
        fit -= Math.min(40, closest * 15);
      }

      if (query.styleSlug && row.tagStyles.length > 0 && !row.tagStyles.includes(query.styleSlug)) {
        fit -= 20;
      }

      return { id: row.id, name: row.name, floors: row.floors, trees, fit };
    })
    .filter((candidate): candidate is SkeletonCandidate => candidate !== null)
    .sort(compareSkeletons);
}

/**
 * Andozalar tartibi.
 *
 * Ilgari bu yerda faqat `second.fit - first.fit` turardi. Ko'pchilik
 * andoza bir xil `fit` oladi (100), ya'ni ularning tartibi bazadan
 * kelgan tartibga — `floors`, keyin `name` ga — tayanib qolardi. Ikki
 * andoza bir xil nomlansa yoki saralash barqarorligiga tayanish
 * to'xtasa, bir xil so'rov turli uy berardi.
 *
 * Endi tartib to'liq aniqlangan: moslik, keyin nom, keyin
 * identifikator. `id` oxirgi bo'lgani uchun natija har doim bir xil.
 */
function compareSkeletons(first: SkeletonCandidate, second: SkeletonCandidate): number {
  if (first.fit !== second.fit) return second.fit - first.fit;
  if (first.name !== second.name) return first.name < second.name ? -1 : 1;
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
}

export function fitsQuery(row: SkeletonRow, query: CandidateQuery): boolean {
  return (
    row.floors === query.floors &&
    row.minWidth <= query.width &&
    row.maxWidth >= query.width &&
    row.minLength <= query.length &&
    row.maxLength >= query.length
  );
}


export function relaxedCandidates(rows: SkeletonRow[], query: CandidateQuery): SkeletonCandidate[] {
  return rows
    .filter((row) => row.floors === query.floors)
    .map((row) => {
      const trees = extractTrees(row.tree);
      if (trees.length !== row.floors) return null;
      return { id: row.id, name: row.name, floors: row.floors, trees, fit: 40 };
    })
    .filter((candidate): candidate is SkeletonCandidate => candidate !== null)
    // Bu yerda ham aniq tartib: hammasining `fit` i bir xil (40),
    // ya'ni saralashsiz tartib butunlay bazaga bog'liq bo'lib qolardi.
    .sort(compareSkeletons);
}

export interface BuildContext {
  rules: Record<string, RoomTypeRule>;
  names: Record<string, string>;
  book: PriceBook;
}

export function buildVariant(
  skeleton: SkeletonCandidate,
  style: StyleConfig,
  params: GenerateParams,
  bounds: Rect,
  context: BuildContext,
): Variant | null {
  const { rules, names, book } = context;

  const options = {
    rules,
    minAreaFactor: style.layout.minAreaFactor,
    corridorWidth: style.layout.corridorWidth,
  };

  const steps = {
    corridorsAdded: 0,
    rebalanced: false,
    roomsAdded: 0,
    roomsRemoved: 0,
    skipped: [] as SkippedRoom[],
  };
  const trees: TreeNode[] = [];

  try {
    const program = applyRoomProgram(skeleton.trees, bounds, params.rooms, options, steps);

    for (const tree of program) {
      const circulation = ensureCirculation(tree, bounds, options);
      steps.corridorsAdded += circulation.carved;

      const balancing = fitAndRebalance(circulation.tree, bounds, options);
      steps.rebalanced = steps.rebalanced || balancing.adjusted;

      trees.push(balancing.tree);
    }
  } catch (error) {
    if (error instanceof GeometryError) return null;
    throw error;
  }

  const extraRequests = requestsFrom(params.garage, params.extras);
  const stairs = trees.length > 1 ? pickStairs(trees[0], bounds) : undefined;

  const { house, skippedExtras } = buildHouse(
    {
      bounds,
      floors: trees.map((tree, index) => ({ level: index + 1, tree, stairs })),
      roof: style.roof,
      extras: extraRequests,
    },
    { rules, layout: style.layout },
  );

  const validation = validateHouse(house, options);
  const estimate = computeEstimate(house, book);

  const coverSvg = toSvg(
    drawFloor(house.floors[0], { names, showDimensions: false, extras: house.extras }),
    { scale: 26, showLabels: false },
  );

  /*
    Yo'nalish bali umumiy ballga QO'SHILADI, lekin faqat u
    berilganda. Berilmaganda eski nisbat saqlanadi — aks holda
    yo'nalishni ko'rsatmagan foydalanuvchining bali sababsiz
    o'zgarardi.
  */
  const orientation = params.northSide
    ? orientationOf(house, params.northSide, rules)
    : null;

  const score = orientation
    ? Math.round(validation.score * 0.6 + skeleton.fit * 0.2 + orientation.score * 0.2)
    : Math.round(validation.score * 0.75 + skeleton.fit * 0.25);

  const errors = validation.issues.filter((issue) => issue.severity === 'error').length;

  return {
    id: variantId(skeleton.id, style.slug, params),
    skeletonId: skeleton.id,
    skeletonName: skeleton.name,
    styleSlug: style.slug,
    geometry: {
      bounds,
      floors: house.floors.map((floor) => ({ level: floor.level, tree: floor.tree })),
      styleSlug: style.slug,
      extras: extraRequests,
    },
    floors: house.floors.map((floor) => ({
      level: floor.level,
      tree: floor.tree,
      rooms: floor.rooms.map((room) => ({
        id: room.id,
        roomType: room.roomType,
        area: room.area,
        ratio: room.ratio,
      })),
    })),
    score,
    issues: validation.issues,
    measurements: estimate.measurements,
    estimateTotal: estimate.total,
    perSquareMeter: estimate.perSquareMeter,
    coverSvg,
    extras: house.extras.map((extra) => ({
      kind: extra.kind,
      area: extra.area,
      side: extra.side,
    })),
    skippedExtras,
    steps,
    scoreParts: {
      plan: validation.score,
      fit: skeleton.fit,
      errors,
      warnings: validation.issues.length - errors,
      orientation: orientation?.score ?? null,
    },
    orientation: orientation?.notes ?? [],
  };
}

export function generateVariants(
  params: GenerateParams,
  skeletonRows: SkeletonRow[],
  styles: StyleConfig[],
  context: BuildContext,
): GenerationResult {
  const bounds: Rect = { x: 0, y: 0, width: params.width, length: params.length };

  const query: CandidateQuery = {
    floors: params.floors,
    bedrooms: params.rooms.bedroom ?? 0,
    width: params.width,
    length: params.length,
    styleSlug: params.styleSlug,
  };

  let skeletons = rankCandidates(
    skeletonRows.filter((row) => fitsQuery(row, query)),
    query,
  );
  let relaxed = false;

  if (skeletons.length === 0) {
    skeletons = relaxedCandidates(skeletonRows, query);
    relaxed = skeletons.length > 0;
  }

  if (skeletons.length === 0) {
    return {
      variants: [],
      relaxed: false,
      message: 'GENERATE_NO_SKELETON',
      messageValues: { floors: params.floors },
    };
  }

  const built: Variant[] = [];

  outer: for (const skeleton of skeletons) {
    for (const style of styles) {
      if (built.length >= MAX_COMBINATIONS) break outer;

      const variant = buildVariant(skeleton, style, params, bounds, context);
      if (variant) built.push(variant);
    }
  }

  const accepted = built
    .filter((variant) => variant.score >= MIN_ACCEPTABLE_SCORE)
    .sort(compareVariants);

  const pool = accepted.length > 0 ? accepted : [...built].sort(compareVariants);

  return {
    variants: pool.slice(0, params.variants),
    relaxed,
    message: relaxed ? 'GENERATE_RELAXED' : undefined,
  };
}

/**
 * Variantlar tartibi.
 *
 * Ball birinchi, lekin u ko'pincha teng chiqadi — 100 ballik shkalada
 * atigi bir necha qiymat bo'ladi (`scoreOf` xatoga 25, ogohlantirishga
 * 6 ball ayiradi). Teng ballda qaysi variant birinchi turishi ilgari
 * tasodifga qolardi.
 *
 * Tenglikda tartib MA'NOLI bo'lishi kerak:
 *   1. kamroq xato — 25 ball ayiradigan muammo eng og'iri;
 *   2. arzonroq — teng sifatda narx hal qiladi;
 *   3. identifikator — natija har doim bir xil bo'lishi uchun.
 */
function compareVariants(first: Variant, second: Variant): number {
  if (first.score !== second.score) return second.score - first.score;
  if (first.scoreParts.errors !== second.scoreParts.errors) {
    return first.scoreParts.errors - second.scoreParts.errors;
  }
  if (first.estimateTotal !== second.estimateTotal) {
    return first.estimateTotal - second.estimateTotal;
  }
  return first.id < second.id ? -1 : first.id > second.id ? 1 : 0;
}

function variantId(skeletonId: string, styleSlug: string, params: GenerateParams): string {
  return hashOf({
    skeletonId,
    styleSlug,
    width: params.width,
    length: params.length,
    floors: params.floors,
    rooms: params.rooms,
  });
}
