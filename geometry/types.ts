export type Meters = number;

export interface Rect {
  x: Meters;
  y: Meters;
  width: Meters;
  length: Meters;
}

export type Axis = 'vertical' | 'horizontal';

export interface SplitNode {
  kind: 'split';
  id: string;
  axis: Axis;
  ratio: number;
  children: [TreeNode, TreeNode];
}

export interface LeafNode {
  kind: 'leaf';
  id: string;
  roomType: string;
  label?: string;
}

export type TreeNode = SplitNode | LeafNode;
export interface Room {
  id: string;
  roomType: string;
  label?: string;
  rect: Rect;
  area: Meters;
  ratio: number;
}

export type WallSide = 'north' | 'south' | 'east' | 'west';

export interface Wall {
  id: string;
  from: { x: Meters; y: Meters };
  to: { x: Meters; y: Meters };
  exterior: boolean;
  rooms: string[];
  thickness: Meters;
}

export type OpeningKind = 'door' | 'window' | 'entrance';

export interface Opening {
  id: string;
  kind: OpeningKind;
  wallId: string;
  offset: Meters;
  width: Meters;
  height: Meters;
  connects?: [string, string];
}

export type ExtraKind = 'garage' | 'terrace' | 'balcony' | 'basement' | 'sauna' | 'pool';

export interface Extra {
  id: string;
  kind: ExtraKind;
  rect: Rect;
  floor: number;
  side: WallSide | null;
  enclosed: boolean;
  area: Meters;
}

export interface Stairs {
  x: Meters;
  y: Meters;
  width: Meters;
  length: Meters;
}

export interface Floor {
  level: number;
  bounds: Rect;
  tree: TreeNode;
  rooms: Room[];
  walls: Wall[];
  openings: Opening[];
  stairs?: Stairs;
  entrySide?: WallSide;
}

export type RoofType = 'flat' | 'shed' | 'gable' | 'hip' | 'pyramid' | 'mansard';

export interface RoofSpec {
  type: RoofType;
  pitch: number;
  overhang: Meters;
  upperPitch?: number;
  breakRatio?: number;
}

export interface Vec3 {
  x: Meters;
  y: Meters;
  z: Meters;
}

export interface RoofPlane {
  id: string;
  vertices: Vec3[];
  area: Meters;
  slope: number;
}

export interface RoofGeometry {
  type: RoofType;
  eaveHeight: Meters;
  ridgeRise: Meters;
  eaveRect: Rect;
  planes: RoofPlane[];
  gables: RoofPlane[];
  ridge?: { from: Vec3; to: Vec3 };
  totalArea: Meters;
}

export type MeshMaterial =
  | 'wall-exterior'
  | 'wall-interior'
  | 'floor'
  | 'ceiling'
  | 'roof'
  | 'glass'
  | 'door'
  | 'stairs';

export interface MeshPart {
  id: string;
  material: MeshMaterial;
  positions: number[];
  indices: number[];
  roomId?: string;
  floor?: number;
}

export interface HouseMesh {
  parts: MeshPart[];
  bbox: { min: Vec3; max: Vec3 };
  triangleCount: number;
}

export interface Point2 {
  x: Meters;
  y: Meters;
}

export type DrawPrimitive =
  | { kind: 'room'; roomId: string; roomType: string; points: Point2[] }
  | { kind: 'wall'; wallId: string; from: Point2; to: Point2; thickness: Meters; exterior: boolean }
  | { kind: 'gap'; openingId: string; from: Point2; to: Point2; thickness: Meters }
  | { kind: 'door-arc'; openingId: string; hinge: Point2; radius: Meters; startAngle: number; sweep: number }
  | { kind: 'door-leaf'; openingId: string; from: Point2; to: Point2 }
  | { kind: 'window'; openingId: string; from: Point2; to: Point2; thickness: Meters }
  | { kind: 'label'; roomId: string; at: Point2; title: string; subtitle: string }
  | { kind: 'dimension'; from: Point2; to: Point2; offset: Meters; text: string; side: 'top' | 'bottom' | 'left' | 'right' }
  | { kind: 'stairs'; at: Point2; width: Meters; length: Meters; steps: number }
  | { kind: 'extra'; extraId: string; extraKind: ExtraKind; rect: Rect; enclosed: boolean; title: string };

export interface Drawing {
  viewBox: { x: number; y: number; width: number; height: number };
  primitives: DrawPrimitive[];
  floor: number;
}

export interface House {
  bounds: Rect;
  floors: Floor[];
  extras: Extra[];
  roof: RoofSpec;
  ceilingHeight: Meters;
  wallThickness: { exterior: Meters; interior: Meters };
}

export interface RoomTypeRule {
  code: string;
  minArea: Meters;
  maxArea: Meters;
  idealRatio: number;
  needsExteriorWall: boolean;
  isWetZone: boolean;
  accessFrom: string[];
  /** Quyosh bo'yicha afzal tomonlar. Bo'sh — farqi yo'q. */
  sunSides?: WallSide[];
}

export interface LayoutRules {
  corridorWidth: Meters;
  openKitchen: boolean;
  minAreaFactor: number;
  ceilingHeight: Meters;
  windowWallAreaRatio: number;
}

export const DEFAULT_LAYOUT_RULES: LayoutRules = {
  corridorWidth: 1.4,
  openKitchen: false,
  minAreaFactor: 1,
  ceilingHeight: 2.8,
  windowWallAreaRatio: 0.15,
};

export const DEFAULT_WALL_THICKNESS = { exterior: 0.4, interior: 0.12 };

export const DOOR_WIDTH = 0.9;
export const DOOR_HEIGHT = 2.1;
export const ENTRANCE_WIDTH = 1.1;

export type IssueCode =
  | 'AREA_TOO_SMALL'
  | 'AREA_TOO_LARGE'
  | 'TOO_NARROW'
  | 'NO_ACCESS'
  | 'NO_WINDOW'
  | 'WET_ZONE_SCATTERED'
  | 'STAIRS_MISSING'
  | 'STAIRS_MISALIGNED'
  | 'INVALID_ACCESS_SOURCE';

export interface Issue {
  code: IssueCode;
  severity: 'error' | 'warning';
  roomId?: string;
  floor?: number;
  /** English, for logs. The browser renders `code` with `values`. */
  message: string;
  values?: Record<string, string | number>;
}

export interface ValidationResult {
  ok: boolean;
  issues: Issue[];
  score: number;
}

export interface Measurements {
  PERIMETER: number;
  FLOOR_AREA: number;
  EXTERIOR_WALL_AREA: number;
  INTERIOR_WALL_AREA: number;
  WALL_AREA: number;
  ROOF_AREA: number;
  FOUNDATION_VOLUME: number;
  CEILING_AREA: number;
  WINDOW_COUNT: number;
  DOOR_COUNT: number;
  WINDOW_AREA: number;
  FLOOR_COUNT: number;
  ROOM_COUNT: number;

  GARAGE_AREA: number;
  TERRACE_AREA: number;
  BALCONY_AREA: number;
  BASEMENT_AREA: number;
  SAUNA_AREA: number;
  POOL_AREA: number;
}
