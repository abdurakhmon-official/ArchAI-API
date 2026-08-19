import type { LeafNode, Rect, Room, SplitNode, TreeNode } from './types';

export function isLeaf(node: TreeNode): node is LeafNode {
  return node.kind === 'leaf';
}

export function isSplit(node: TreeNode): node is SplitNode {
  return node.kind === 'split';
}

export function leaves(node: TreeNode): LeafNode[] {
  if (isLeaf(node)) return [node];
  return [...leaves(node.children[0]), ...leaves(node.children[1])];
}

export function nodes(node: TreeNode): TreeNode[] {
  if (isLeaf(node)) return [node];
  return [node, ...nodes(node.children[0]), ...nodes(node.children[1])];
}

export function findNode(root: TreeNode, id: string): TreeNode | null {
  if (root.id === id) return root;
  if (isLeaf(root)) return null;
  return findNode(root.children[0], id) ?? findNode(root.children[1], id);
}

export function findParent(
  root: TreeNode,
  id: string,
): { parent: SplitNode; side: 0 | 1 } | null {
  if (isLeaf(root)) return null;
  if (root.children[0].id === id) return { parent: root, side: 0 };
  if (root.children[1].id === id) return { parent: root, side: 1 };
  return findParent(root.children[0], id) ?? findParent(root.children[1], id);
}

export function depth(node: TreeNode): number {
  if (isLeaf(node)) return 1;
  return 1 + Math.max(depth(node.children[0]), depth(node.children[1]));
}

export function cloneTree<T extends TreeNode>(node: T): T {
  if (isLeaf(node)) return { ...node };
  return {
    ...node,
    children: [cloneTree(node.children[0]), cloneTree(node.children[1])],
  } as T;
}

export function nextNodeId(root: TreeNode, prefix = 'n'): string {
  let max = 0;
  for (const node of nodes(root)) {
    const match = new RegExp(`^${prefix}(\\d+)$`).exec(node.id);
    if (match) max = Math.max(max, Number(match[1]));
  }
  return `${prefix}${max + 1}`;
}

export function splitRect(rect: Rect, axis: SplitNode['axis'], ratio: number): [Rect, Rect] {
  if (axis === 'vertical') {
    const first = rect.width * ratio;
    return [
      { x: rect.x, y: rect.y, width: first, length: rect.length },
      { x: rect.x + first, y: rect.y, width: rect.width - first, length: rect.length },
    ];
  }
  const first = rect.length * ratio;
  return [
    { x: rect.x, y: rect.y, width: rect.width, length: first },
    { x: rect.x, y: rect.y + first, width: rect.width, length: rect.length - first },
  ];
}

export function computeRects(root: TreeNode, bounds: Rect): Map<string, Rect> {
  const out = new Map<string, Rect>();

  const walk = (node: TreeNode, rect: Rect): void => {
    out.set(node.id, rect);
    if (isLeaf(node)) return;
    const [a, b] = splitRect(rect, node.axis, node.ratio);
    walk(node.children[0], a);
    walk(node.children[1], b);
  };

  walk(root, bounds);
  return out;
}

export function computeRooms(root: TreeNode, bounds: Rect): Room[] {
  const rects = computeRects(root, bounds);

  return leaves(root).map((leaf) => {
    const rect = rects.get(leaf.id)!;
    const long = Math.max(rect.width, rect.length);
    const short = Math.min(rect.width, rect.length);

    return {
      id: leaf.id,
      roomType: leaf.roomType,
      label: leaf.label,
      rect,
      area: round(rect.width * rect.length),
      ratio: short === 0 ? Infinity : round(long / short),
    };
  });
}

export function countByType(root: TreeNode): Record<string, number> {
  const out: Record<string, number> = {};
  for (const leaf of leaves(root)) {
    out[leaf.roomType] = (out[leaf.roomType] ?? 0) + 1;
  }
  return out;
}

export function round(value: number, digits = 2): number {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}
