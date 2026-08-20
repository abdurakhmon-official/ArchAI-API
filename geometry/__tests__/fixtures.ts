import type { Rect, RoomTypeRule, TreeNode } from '../types';

/** Sinov uchun xona qoidalari — bazadagi `roomTypes` bilan bir xil shakl. */
export const RULES: Record<string, RoomTypeRule> = {
  living: {
    code: 'living',
    minArea: 16,
    maxArea: 45,
    idealRatio: 1.5,
    needsExteriorWall: true,
    isWetZone: false,
    accessFrom: [],
  },
  bedroom: {
    code: 'bedroom',
    minArea: 9,
    maxArea: 25,
    idealRatio: 1.3,
    needsExteriorWall: true,
    isWetZone: false,
    accessFrom: [],
  },
  kitchen: {
    code: 'kitchen',
    minArea: 8,
    maxArea: 20,
    idealRatio: 1.4,
    needsExteriorWall: true,
    isWetZone: true,
    accessFrom: [],
  },
  bathroom: {
    code: 'bathroom',
    minArea: 3,
    maxArea: 8,
    idealRatio: 1.5,
    needsExteriorWall: false,
    isWetZone: true,
    accessFrom: ['corridor', 'living'],
  },
  corridor: {
    code: 'corridor',
    minArea: 3,
    maxArea: 20,
    idealRatio: 3,
    needsExteriorWall: false,
    isWetZone: false,
    accessFrom: [],
  },
};

export const OPTIONS: { rules: Record<string, RoomTypeRule> } = { rules: RULES };

/** 12 × 15 m — rejadagi misol uy. */
export const BOUNDS: Rect = { x: 0, y: 0, width: 12, length: 15 };

/**
 * Rejadagi namuna daraxt:
 *   vertikal 60% → chap: mehmonxona / (oshxona | sanuzel), o'ng: 2 yotoqxona
 */
export function sampleTree(): TreeNode {
  return {
    kind: 'split',
    id: 's1',
    axis: 'vertical',
    ratio: 0.6,
    children: [
      {
        kind: 'split',
        id: 's2',
        axis: 'horizontal',
        ratio: 0.55,
        children: [
          { kind: 'leaf', id: 'n1', roomType: 'living' },
          {
            kind: 'split',
            id: 's3',
            axis: 'vertical',
            ratio: 0.55,
            children: [
              { kind: 'leaf', id: 'n2', roomType: 'kitchen' },
              { kind: 'leaf', id: 'n3', roomType: 'bathroom' },
            ],
          },
        ],
      },
      {
        kind: 'split',
        id: 's4',
        axis: 'horizontal',
        ratio: 0.5,
        children: [
          { kind: 'leaf', id: 'n4', roomType: 'bedroom' },
          { kind: 'leaf', id: 'n5', roomType: 'bedroom' },
        ],
      },
    ],
  };
}
