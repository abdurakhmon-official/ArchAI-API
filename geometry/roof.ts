import { round } from './tree';
import type { Rect, RoofGeometry, RoofPlane, RoofSpec, Vec3 } from './types';

const FLAT_DRAINAGE_PITCH = 2;
const MAX_PITCH = 60;

export interface RoofInput {
  bounds: Rect;
  spec: RoofSpec;
  eaveHeight: number;
}

export function buildRoof({ bounds, spec, eaveHeight }: RoofInput): RoofGeometry {
  const eaveRect = expand(bounds, spec.overhang);
  const pitch = clampPitch(spec.type === 'flat' ? FLAT_DRAINAGE_PITCH : spec.pitch);

  switch (spec.type) {
    case 'flat':
      return flatRoof(eaveRect, eaveHeight, pitch);
    case 'shed':
      return shedRoof(eaveRect, eaveHeight, pitch);
    case 'hip':
      return hipRoof(eaveRect, eaveHeight, pitch);
    case 'pyramid':
      return pyramidRoof(eaveRect, eaveHeight, pitch);
    case 'mansard':
      return mansardRoof(eaveRect, eaveHeight, pitch, spec);
    case 'gable':
    default:
      return gableRoof(eaveRect, eaveHeight, pitch);
  }
}

function flatRoof(rect: Rect, eaveHeight: number, pitch: number): RoofGeometry {
  const { uMin, uMax, vMin, vMax, toPoint } = frame(rect);
  const rise = (vMax - vMin) * Math.tan(toRadians(pitch));

  const plane = makePlane('r1', [
    toPoint(uMin, vMin, eaveHeight),
    toPoint(uMax, vMin, eaveHeight),
    toPoint(uMax, vMax, eaveHeight + rise),
    toPoint(uMin, vMax, eaveHeight + rise),
  ]);

  return {
    type: 'flat',
    eaveHeight,
    ridgeRise: round(rise),
    eaveRect: rect,
    planes: [plane],
    gables: [],
    totalArea: plane.area,
  };
}

function shedRoof(rect: Rect, eaveHeight: number, pitch: number): RoofGeometry {
  const { uMin, uMax, vMin, vMax, toPoint } = frame(rect);
  const rise = (vMax - vMin) * Math.tan(toRadians(pitch));

  const plane = makePlane('r1', [
    toPoint(uMin, vMin, eaveHeight),
    toPoint(uMax, vMin, eaveHeight),
    toPoint(uMax, vMax, eaveHeight + rise),
    toPoint(uMin, vMax, eaveHeight + rise),
  ]);

  const gables = [
    makePlane('g1', [
      toPoint(uMin, vMin, eaveHeight),
      toPoint(uMin, vMax, eaveHeight + rise),
      toPoint(uMin, vMax, eaveHeight),
    ]),
    makePlane('g2', [
      toPoint(uMax, vMin, eaveHeight),
      toPoint(uMax, vMax, eaveHeight),
      toPoint(uMax, vMax, eaveHeight + rise),
    ]),
  ];

  return {
    type: 'shed',
    eaveHeight,
    ridgeRise: round(rise),
    eaveRect: rect,
    planes: [plane],
    gables,
    ridge: roundRidge({
      from: toPoint(uMin, vMax, eaveHeight + rise),
      to: toPoint(uMax, vMax, eaveHeight + rise),
    }),
    totalArea: plane.area,
  };
}

function gableRoof(rect: Rect, eaveHeight: number, pitch: number): RoofGeometry {
  const { uMin, uMax, vMin, vMax, toPoint } = frame(rect);
  const vMid = (vMin + vMax) / 2;
  const rise = ((vMax - vMin) / 2) * Math.tan(toRadians(pitch));
  const ridgeZ = eaveHeight + rise;

  const planes = [
    makePlane('r1', [
      toPoint(uMin, vMin, eaveHeight),
      toPoint(uMax, vMin, eaveHeight),
      toPoint(uMax, vMid, ridgeZ),
      toPoint(uMin, vMid, ridgeZ),
    ]),
    makePlane('r2', [
      toPoint(uMax, vMax, eaveHeight),
      toPoint(uMin, vMax, eaveHeight),
      toPoint(uMin, vMid, ridgeZ),
      toPoint(uMax, vMid, ridgeZ),
    ]),
  ];

  const gables = [
    makePlane('g1', [
      toPoint(uMin, vMin, eaveHeight),
      toPoint(uMin, vMid, ridgeZ),
      toPoint(uMin, vMax, eaveHeight),
    ]),
    makePlane('g2', [
      toPoint(uMax, vMax, eaveHeight),
      toPoint(uMax, vMid, ridgeZ),
      toPoint(uMax, vMin, eaveHeight),
    ]),
  ];

  return {
    type: 'gable',
    eaveHeight,
    ridgeRise: round(rise),
    eaveRect: rect,
    planes,
    gables,
    ridge: roundRidge({
      from: toPoint(uMin, vMid, ridgeZ),
      to: toPoint(uMax, vMid, ridgeZ),
    }),
    totalArea: round(planes.reduce((sum, plane) => sum + plane.area, 0)),
  };
}

function hipRoof(rect: Rect, eaveHeight: number, pitch: number): RoofGeometry {
  const { uMin, uMax, vMin, vMax, toPoint } = frame(rect);
  const vMid = (vMin + vMax) / 2;
  const halfSpan = (vMax - vMin) / 2;
  const rise = halfSpan * Math.tan(toRadians(pitch));
  const ridgeZ = eaveHeight + rise;

  const ridgeStart = Math.min(uMin + halfSpan, (uMin + uMax) / 2);
  const ridgeEnd = Math.max(uMax - halfSpan, (uMin + uMax) / 2);

  const planes = [
    makePlane('r1', [
      toPoint(uMin, vMin, eaveHeight),
      toPoint(uMax, vMin, eaveHeight),
      toPoint(ridgeEnd, vMid, ridgeZ),
      toPoint(ridgeStart, vMid, ridgeZ),
    ]),
    makePlane('r2', [
      toPoint(uMax, vMax, eaveHeight),
      toPoint(uMin, vMax, eaveHeight),
      toPoint(ridgeStart, vMid, ridgeZ),
      toPoint(ridgeEnd, vMid, ridgeZ),
    ]),
    makePlane('r3', [
      toPoint(uMin, vMax, eaveHeight),
      toPoint(uMin, vMin, eaveHeight),
      toPoint(ridgeStart, vMid, ridgeZ),
    ]),
    makePlane('r4', [
      toPoint(uMax, vMin, eaveHeight),
      toPoint(uMax, vMax, eaveHeight),
      toPoint(ridgeEnd, vMid, ridgeZ),
    ]),
  ];

  return {
    type: 'hip',
    eaveHeight,
    ridgeRise: round(rise),
    eaveRect: rect,
    planes,
    gables: [],
    ridge: roundRidge({
      from: toPoint(ridgeStart, vMid, ridgeZ),
      to: toPoint(ridgeEnd, vMid, ridgeZ),
    }),
    totalArea: round(planes.reduce((sum, plane) => sum + plane.area, 0)),
  };
}

function pyramidRoof(rect: Rect, eaveHeight: number, pitch: number): RoofGeometry {
  const { uMin, uMax, vMin, vMax, toPoint } = frame(rect);

  const uMid = (uMin + uMax) / 2;
  const vMid = (vMin + vMax) / 2;
  const rise = ((vMax - vMin) / 2) * Math.tan(toRadians(pitch));
  const apexZ = eaveHeight + rise;
  const apex = toPoint(uMid, vMid, apexZ);

  const planes = [
    makePlane('r1', [toPoint(uMin, vMin, eaveHeight), toPoint(uMax, vMin, eaveHeight), apex]),
    makePlane('r2', [toPoint(uMax, vMin, eaveHeight), toPoint(uMax, vMax, eaveHeight), apex]),
    makePlane('r3', [toPoint(uMax, vMax, eaveHeight), toPoint(uMin, vMax, eaveHeight), apex]),
    makePlane('r4', [toPoint(uMin, vMax, eaveHeight), toPoint(uMin, vMin, eaveHeight), apex]),
  ];

  return {
    type: 'pyramid',
    eaveHeight,
    ridgeRise: round(rise),
    eaveRect: rect,
    planes,
    gables: [],
    ridge: roundRidge({ from: apex, to: apex }),
    totalArea: round(planes.reduce((sum, plane) => sum + plane.area, 0)),
  };
}

function mansardRoof(
  rect: Rect,
  eaveHeight: number,
  pitch: number,
  spec: RoofSpec,
): RoofGeometry {
  const { uMin, uMax, vMin, vMax, toPoint } = frame(rect);

  const vMid = (vMin + vMax) / 2;
  const halfSpan = (vMax - vMin) / 2;

  const lowerPitch = clampPitch(pitch);
  const upperPitch = clampPitch(
    Math.min(spec.upperPitch ?? lowerPitch / 2.5, lowerPitch - 1),
  );

  const breakRatio = clamp(spec.breakRatio ?? 0.5, 0.15, 0.85);

  const breakInset = halfSpan * breakRatio;
  const breakZ = eaveHeight + breakInset * Math.tan(toRadians(lowerPitch));

  const topInset = halfSpan;
  const ridgeZ = breakZ + (topInset - breakInset) * Math.tan(toRadians(upperPitch));

  const ridgeHalf = topInset - breakInset;
  const ridgeStart = Math.min(uMin + breakInset + ridgeHalf, (uMin + uMax) / 2);
  const ridgeEnd = Math.max(uMax - breakInset - ridgeHalf, (uMin + uMax) / 2);

  const bMinU = uMin + breakInset;
  const bMaxU = uMax - breakInset;
  const bMinV = vMin + breakInset;
  const bMaxV = vMax - breakInset;

  const planes = [
    makePlane('l1', [
      toPoint(uMin, vMin, eaveHeight),
      toPoint(uMax, vMin, eaveHeight),
      toPoint(bMaxU, bMinV, breakZ),
      toPoint(bMinU, bMinV, breakZ),
    ]),
    makePlane('l2', [
      toPoint(uMax, vMax, eaveHeight),
      toPoint(uMin, vMax, eaveHeight),
      toPoint(bMinU, bMaxV, breakZ),
      toPoint(bMaxU, bMaxV, breakZ),
    ]),
    makePlane('l3', [
      toPoint(uMin, vMax, eaveHeight),
      toPoint(uMin, vMin, eaveHeight),
      toPoint(bMinU, bMinV, breakZ),
      toPoint(bMinU, bMaxV, breakZ),
    ]),
    makePlane('l4', [
      toPoint(uMax, vMin, eaveHeight),
      toPoint(uMax, vMax, eaveHeight),
      toPoint(bMaxU, bMaxV, breakZ),
      toPoint(bMaxU, bMinV, breakZ),
    ]),

    // --- Yuqori halqa: sinishdan tepagacha, valma tom naqshi ---
    makePlane('u1', [
      toPoint(bMinU, bMinV, breakZ),
      toPoint(bMaxU, bMinV, breakZ),
      toPoint(ridgeEnd, vMid, ridgeZ),
      toPoint(ridgeStart, vMid, ridgeZ),
    ]),
    makePlane('u2', [
      toPoint(bMaxU, bMaxV, breakZ),
      toPoint(bMinU, bMaxV, breakZ),
      toPoint(ridgeStart, vMid, ridgeZ),
      toPoint(ridgeEnd, vMid, ridgeZ),
    ]),
    makePlane('u3', [
      toPoint(bMinU, bMaxV, breakZ),
      toPoint(bMinU, bMinV, breakZ),
      toPoint(ridgeStart, vMid, ridgeZ),
    ]),
    makePlane('u4', [
      toPoint(bMaxU, bMinV, breakZ),
      toPoint(bMaxU, bMaxV, breakZ),
      toPoint(ridgeEnd, vMid, ridgeZ),
    ]),
  ];

  return {
    type: 'mansard',
    eaveHeight,
    ridgeRise: round(ridgeZ - eaveHeight),
    eaveRect: rect,
    planes,
    gables: [],
    ridge: roundRidge({
      from: toPoint(ridgeStart, vMid, ridgeZ),
      to: toPoint(ridgeEnd, vMid, ridgeZ),
    }),
    totalArea: round(planes.reduce((sum, plane) => sum + plane.area, 0)),
  };
}

function frame(rect: Rect) {
  const ridgeAlongX = rect.width >= rect.length;

  return ridgeAlongX
    ? {
        uMin: rect.x,
        uMax: rect.x + rect.width,
        vMin: rect.y,
        vMax: rect.y + rect.length,
        toPoint: (u: number, v: number, z: number): Vec3 => ({ x: u, y: v, z }),
      }
    : {
        uMin: rect.y,
        uMax: rect.y + rect.length,
        vMin: rect.x,
        vMax: rect.x + rect.width,
        toPoint: (u: number, v: number, z: number): Vec3 => ({ x: v, y: u, z }),
      };
}

function roundVec(point: Vec3): Vec3 {
  return { x: round(point.x), y: round(point.y), z: round(point.z) };
}

function roundRidge(ridge: { from: Vec3; to: Vec3 }): { from: Vec3; to: Vec3 } {
  return { from: roundVec(ridge.from), to: roundVec(ridge.to) };
}

function expand(rect: Rect, by: number): Rect {
  return {
    x: round(rect.x - by),
    y: round(rect.y - by),
    width: round(rect.width + by * 2),
    length: round(rect.length + by * 2),
  };
}

function makePlane(id: string, vertices: Vec3[]): RoofPlane {
  const normal = newellNormal(vertices);
  const magnitude = Math.hypot(normal.x, normal.y, normal.z);

  return {
    id,
    vertices: vertices.map(roundVec),
    area: round(magnitude / 2),
    slope: round(magnitude === 0 ? 0 : toDegrees(Math.acos(Math.abs(normal.z) / magnitude)), 1),
  };
}

function newellNormal(points: Vec3[]): Vec3 {
  let x = 0;
  let y = 0;
  let z = 0;

  for (let i = 0; i < points.length; i++) {
    const a = points[i];
    const b = points[(i + 1) % points.length];
    x += a.y * b.z - a.z * b.y;
    y += a.z * b.x - a.x * b.z;
    z += a.x * b.y - a.y * b.x;
  }

  return { x, y, z };
}

export function polygonArea3(points: Vec3[]): number {
  const normal = newellNormal(points);
  return Math.hypot(normal.x, normal.y, normal.z) / 2;
}

function clampPitch(pitch: number): number {
  return clamp(pitch, 0, MAX_PITCH);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function toRadians(degrees: number): number {
  return (degrees * Math.PI) / 180;
}

function toDegrees(radians: number): number {
  return (radians * 180) / Math.PI;
}

/** Devor tepasi — qavatlar soni × shift balandligi + oraliq plita. */
export function eaveHeightFor(floors: number, ceilingHeight: number, slabThickness = 0.25): number {
  return round(floors * ceilingHeight + Math.max(0, floors - 1) * slabThickness);
}
