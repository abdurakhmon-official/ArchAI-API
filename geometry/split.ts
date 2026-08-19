import { cloneTree, computeRects, findParent, isLeaf, leaves, nextNodeId, splitRect } from './tree';
import type { LeafNode, Rect, RoomTypeRule, SplitNode, TreeNode } from './types';

export interface SplitOptions {
  rules: Record<string, RoomTypeRule>;
  minAreaFactor?: number;
}

export const MAX_ROOM_RATIO = 3;

export class GeometryError extends Error {
  constructor(
    message: string,
    readonly code: string,
  ) {
    super(message);
    this.name = 'GeometryError';
  }
}

function minAreaOf(roomType: string, options: SplitOptions): number {
  const rule = options.rules[roomType];
  const factor = options.minAreaFactor ?? 1;
  return (rule?.minArea ?? 6) * factor;
}

function idealAreaOf(roomType: string, options: SplitOptions): number {
  const rule = options.rules[roomType];
  if (!rule) return 12;
  return (rule.minArea + rule.maxArea) / 2;
}

interface SplitPlan {
  axis: SplitNode['axis'];
  ratio: number;
  worstRatio: number;
}

function planSplit(
  rect: Rect,
  existingType: string,
  newType: string,
  options: SplitOptions,
): SplitPlan | null {
  const area = rect.width * rect.length;
  const minExisting = minAreaOf(existingType, options);
  const minNew = minAreaOf(newType, options);

  if (area < minExisting + minNew) return null;

  const wantedNew = Math.min(idealAreaOf(newType, options), area - minExisting);
  const newArea = Math.max(minNew, wantedNew);
  const ratio = clamp((area - newArea) / area, 0.15, 0.85);

  const candidates: SplitPlan[] = (['vertical', 'horizontal'] as const).map((axis) => {
    const [a, b] = splitRect(rect, axis, ratio);
    return { axis, ratio, worstRatio: Math.max(aspect(a), aspect(b)) };
  });

  candidates.sort((first, second) => first.worstRatio - second.worstRatio);
  return candidates[0];
}

function aspect(rect: Rect): number {
  const long = Math.max(rect.width, rect.length);
  const short = Math.min(rect.width, rect.length);
  return short === 0 ? Infinity : long / short;
}

export function splitLeaf(
  root: TreeNode,
  leafId: string,
  newRoomType: string,
  bounds: Rect,
  options: SplitOptions,
): TreeNode {
  const rects = computeRects(root, bounds);
  const rect = rects.get(leafId);
  if (!rect) throw new GeometryError(`leaf not found: ${leafId}`, 'LEAF_NOT_FOUND');

  const node = findLeaf(root, leafId);
  if (!node) throw new GeometryError(`leaf not found: ${leafId}`, 'LEAF_NOT_FOUND');

  const plan = planSplit(rect, node.roomType, newRoomType, options);

  if (!plan) {
    const area = rect.width * rect.length;
    const needed = minAreaOf(node.roomType, options) + minAreaOf(newRoomType, options);
    throw new GeometryError(
      `room too small to split: ${area.toFixed(1)} m² < ${needed.toFixed(1)} m²`,
      'AREA_TOO_SMALL',
    );
  }

  const clone = cloneTree(root);
  const targetId = nextNodeId(clone);
  const splitId = nextNodeId(clone, 's');

  const replacement: SplitNode = {
    kind: 'split',
    id: splitId,
    axis: plan.axis,
    ratio: plan.ratio,
    children: [
      { kind: 'leaf', id: node.id, roomType: node.roomType, label: node.label },
      { kind: 'leaf', id: targetId, roomType: newRoomType },
    ],
  };

  return replaceNode(clone, leafId, replacement);
}

export function addRoom(
  root: TreeNode,
  bounds: Rect,
  newRoomType: string,
  options: SplitOptions,
): TreeNode {
  const rects = computeRects(root, bounds);
  const minNew = minAreaOf(newRoomType, options);

  const candidates = leaves(root)
    .map((leaf) => {
      const rect = rects.get(leaf.id)!;
      const area = rect.width * rect.length;
      const minExisting = minAreaOf(leaf.roomType, options);
      const plan = planSplit(rect, leaf.roomType, newRoomType, options);

      return {
        leaf,
        surplus: area - minExisting - minNew,
        worstRatio: plan?.worstRatio ?? Infinity,
        corridorPenalty: leaf.roomType === 'corridor' ? 1 : 0,
      };
    })
    .filter((candidate) => candidate.surplus > 0 && Number.isFinite(candidate.worstRatio));

  if (candidates.length === 0) {
    throw new GeometryError(
      'no room has enough space to split — increase house dimensions first',
      'NO_SPACE',
    );
  }

  const wellShaped = candidates.filter((candidate) => candidate.worstRatio <= MAX_ROOM_RATIO);
  const pool = wellShaped.length > 0 ? wellShaped : candidates;

  pool.sort((first, second) => {
    if (first.corridorPenalty !== second.corridorPenalty) {
      return first.corridorPenalty - second.corridorPenalty;
    }
    if (wellShaped.length === 0) return first.worstRatio - second.worstRatio;
    return second.surplus - first.surplus;
  });

  return splitLeaf(root, pool[0].leaf.id, newRoomType, bounds, options);
}

export function removeRoom(root: TreeNode, leafId: string): TreeNode {
  if (isLeaf(root)) {
    throw new GeometryError('cannot remove the only room', 'LAST_ROOM');
  }

  const found = findParent(root, leafId);
  if (!found) throw new GeometryError(`leaf not found: ${leafId}`, 'LEAF_NOT_FOUND');

  const sibling = found.parent.children[found.side === 0 ? 1 : 0];

  if (found.parent.id === root.id) {
    return cloneTree(sibling);
  }

  return replaceNode(cloneTree(root), found.parent.id, cloneTree(sibling));
}

export function mergeLeaves(root: TreeNode, splitId: string): TreeNode {
  const node = findNodeById(root, splitId);
  if (!node || isLeaf(node)) {
    throw new GeometryError(`split not found: ${splitId}`, 'SPLIT_NOT_FOUND');
  }

  const [first, second] = node.children;
  if (!isLeaf(first) || !isLeaf(second)) {
    throw new GeometryError('can only merge two leaf rooms', 'NOT_LEAVES');
  }

  const merged: LeafNode = { kind: 'leaf', id: first.id, roomType: first.roomType, label: first.label };

  if (node.id === root.id) return merged;
  return replaceNode(cloneTree(root), node.id, merged);
}

export function changeRoomType(root: TreeNode, leafId: string, roomType: string): TreeNode {
  const clone = cloneTree(root);
  const node = findLeaf(clone, leafId);
  if (!node) throw new GeometryError(`leaf not found: ${leafId}`, 'LEAF_NOT_FOUND');
  node.roomType = roomType;
  return clone;
}

export function renameRoom(root: TreeNode, leafId: string, label: string): TreeNode {
  const clone = cloneTree(root);
  const node = findLeaf(clone, leafId);
  if (!node) throw new GeometryError(`leaf not found: ${leafId}`, 'LEAF_NOT_FOUND');
  node.label = label;
  return clone;
}

function findLeaf(root: TreeNode, id: string): LeafNode | null {
  const node = findNodeById(root, id);
  return node && isLeaf(node) ? node : null;
}

function findNodeById(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  if (isLeaf(root)) return null;
  return findNodeById(root.children[0], id) ?? findNodeById(root.children[1], id);
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

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
