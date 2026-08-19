export * from './types';

export { createRng, type Rng } from './random';

export {
  isLeaf,
  isSplit,
  leaves,
  nodes,
  findNode,
  findParent,
  depth,
  cloneTree,
  nextNodeId,
  splitRect,
  computeRects,
  computeRooms,
  countByType,
  round,
} from './tree';

export {
  GeometryError,
  MAX_ROOM_RATIO,
  addRoom,
  removeRoom,
  splitLeaf,
  mergeLeaves,
  changeRoomType,
  renameRoom,
  clamp,
  type SplitOptions,
} from './split';

export {
  moveSplit,
  fitToBounds,
  fitAndRebalance,
  rebalance,
  requiredScale,
} from './resize';

export {
  carveCorridor,
  ensureCirculation,
  type CorridorOptions,
} from './corridor';

export { orientationOf, toCompass, edgesOf, type OrientationResult, type OrientationNote } from './orientation';
export {
  applyRoomProgram,
  type ProgramSteps,
  type RoomProgram,
} from './program';

export {
  placeExtras,
  requestsFrom,
  envelope,
  areaByKind,
  type ExtraRequest,
  type PlaceExtrasInput,
  type PlaceExtrasResult,
} from './extras';

export {
  buildAdjacency,
  wallLength,
  pathExists,
  type Adjacency,
} from './adjacency';

export {
  pickEntryRoom,
  placeDoors,
  placeEntrance,
  placeWindows,
  type OpeningOptions,
} from './openings';

export {
  buildFloor,
  buildHouse,
  pickStairs,
  type BuildOptions,
  type BuildHouseInput,
  type BuiltFloor,
  type FloorSpec,
} from './layout';

export { buildRoof, polygonArea3, eaveHeightFor, type RoofInput } from './roof';

export { buildMesh, type MeshOptions } from './mesh';

export { drawFloor, toSvg, type DrawOptions, type SvgOptions } from './drawing';

export { measure, measureRoom } from './measure';

export { validateHouse, validateFloor, type ValidateOptions } from './validate';
