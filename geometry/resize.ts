import { clamp, GeometryError, type SplitOptions } from './split';
import { cloneTree, computeRects, isLeaf, leaves, splitRect } from './tree';
import { maxRatioFor } from './validate';
import type { Rect, TreeNode } from './types';

export function moveSplit(
  root: TreeNode,
  splitId: string,
  ratio: number,
  bounds: Rect,
  options: SplitOptions,
): TreeNode {
  const clone = cloneTree(root);
  const node = find(clone, splitId);

  if (!node || isLeaf(node)) {
    throw new GeometryError(`split not found: ${splitId}`, 'SPLIT_NOT_FOUND');
  }

  const rects = computeRects(clone, bounds);
  const rect = rects.get(splitId)!;
  const total = node.axis === 'vertical' ? rect.width : rect.length;
  const cross = node.axis === 'vertical' ? rect.length : rect.width;

  const minFirst = maxMinArea(node.children[0], options) / cross;
  const minSecond = maxMinArea(node.children[1], options) / cross;

  const lower = minFirst / total;
  const upper = 1 - minSecond / total;

  if (lower > upper) {
    throw new GeometryError('not enough space to move this wall', 'NO_SPACE');
  }

  node.ratio = clamp(ratio, lower, upper);
  return clone;
}

export function fitToBounds(
  root: TreeNode,
  bounds: Rect,
  options: SplitOptions,
): { tree: TreeNode; tooSmall: string[] } {
  const rects = computeRects(root, bounds);
  const tooSmall: string[] = [];

  for (const leaf of leaves(root)) {
    const rect = rects.get(leaf.id)!;
    const area = rect.width * rect.length;
    const min = (options.rules[leaf.roomType]?.minArea ?? 6) * (options.minAreaFactor ?? 1);
    if (area < min) tooSmall.push(leaf.id);
  }

  return { tree: cloneTree(root), tooSmall };
}

export function rebalance(
  root: TreeNode,
  bounds: Rect,
  options: SplitOptions,
  strength = 1,
): TreeNode {
  const blend = Math.min(Math.max(strength, 0), 1);

  const walk = (node: TreeNode, rect: Rect): TreeNode => {
    if (isLeaf(node)) return { ...node };

    const available = rect.width * rect.length;
    const first = capacityOf(node.children[0], options);
    const second = capacityOf(node.children[1], options);

    const share = allocate(available, first, second);
    const ratio = clampRatio(node.ratio * (1 - blend) + share * blend);

    const [a, b] = splitRect(rect, node.axis, ratio);

    return {
      ...node,
      ratio,
      children: [walk(node.children[0], a), walk(node.children[1], b)],
    };
  };

  return walk(root, bounds);
}

interface Capacity {
  min: number;
  max: number;
}

function capacityOf(node: TreeNode, options: SplitOptions): Capacity {
  const factor = options.minAreaFactor ?? 1;

  return leaves(node).reduce<Capacity>(
    (sum, leaf) => {
      const rule = options.rules[leaf.roomType];
      return {
        min: sum.min + (rule?.minArea ?? 6) * factor,
        max: sum.max + (rule?.maxArea ?? 24),
      };
    },
    { min: 0, max: 0 },
  );
}

function allocate(available: number, first: Capacity, second: Capacity): number {
  const minSum = first.min + second.min;
  const maxSum = first.max + second.max;

  if (available <= 0) return 0.5;
  if (minSum <= 0 && maxSum <= 0) return 0.5;

  if (available <= minSum) {
    return minSum === 0 ? 0.5 : first.min / minSum;
  }

  if (available >= maxSum) {
    return maxSum === 0 ? 0.5 : first.max / maxSum;
  }

  const slack = maxSum - minSum;
  const surplus = available - minSum;
  const firstShare = first.min + (surplus * (first.max - first.min)) / slack;

  return firstShare / available;
}

function clampRatio(ratio: number): number {
  return Math.min(0.88, Math.max(0.12, ratio));
}

export function fitAndRebalance(
  root: TreeNode,
  bounds: Rect,
  options: SplitOptions,
): { tree: TreeNode; adjusted: boolean } {
  if (violationCount(root, bounds, options) === 0) {
    return { tree: cloneTree(root), adjusted: false };
  }

  let best = cloneTree(root);
  let bestScore = violationCount(root, bounds, options);

  for (const strength of [0.35, 0.6, 0.85, 1]) {
    const candidate = rebalance(root, bounds, options, strength);
    const score = violationCount(candidate, bounds, options);

    if (score < bestScore) {
      best = candidate;
      bestScore = score;
    }

    if (bestScore === 0) break;
  }

  return { tree: best, adjusted: true };
}

function violationCount(root: TreeNode, bounds: Rect, options: SplitOptions): number {
  const rects = computeRects(root, bounds);
  const factor = options.minAreaFactor ?? 1;
  let count = 0;

  for (const leaf of leaves(root)) {
    const rect = rects.get(leaf.id)!;
    const area = rect.width * rect.length;
    const rule = options.rules[leaf.roomType];
    if (!rule) continue;

    if (area < rule.minArea * factor) count += 1;
    else if (area > rule.maxArea * 1.6) count += 1;

    const long = Math.max(rect.width, rect.length);
    const short = Math.min(rect.width, rect.length);
    const ratio = short === 0 ? Infinity : long / short;

    if (ratio > maxRatioFor(rule)) count += 1;
  }

  return count;
}

export function requiredScale(root: TreeNode, bounds: Rect, options: SplitOptions): number {
  const rects = computeRects(root, bounds);
  let worst = 1;

  for (const leaf of leaves(root)) {
    const rect = rects.get(leaf.id)!;
    const area = rect.width * rect.length;
    const min = (options.rules[leaf.roomType]?.minArea ?? 6) * (options.minAreaFactor ?? 1);
    if (area > 0 && area < min) worst = Math.max(worst, min / area);
  }

  return Math.sqrt(worst);
}

function maxMinArea(node: TreeNode, options: SplitOptions): number {
  const factor = options.minAreaFactor ?? 1;
  return leaves(node).reduce(
    (sum, leaf) => sum + (options.rules[leaf.roomType]?.minArea ?? 6) * factor,
    0,
  );
}

function find(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  if (isLeaf(root)) return null;
  return find(root.children[0], id) ?? find(root.children[1], id);
}
