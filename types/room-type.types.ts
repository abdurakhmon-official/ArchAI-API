interface RoomTypeRow {
  code: string;
  minArea: number;
  maxArea: number;
  idealRatio: number;
  needsExteriorWall: boolean;
  isWetZone: boolean;
  accessFrom: string[];
  sunSides?: string[];
}

export type { RoomTypeRow };
