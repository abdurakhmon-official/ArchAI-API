interface RoomTypeRow {
  code: string;
  min_area: number;
  max_area: number;
  ideal_ratio: number;
  needs_exterior_wall: boolean;
  is_wet_zone: boolean;
  access_from: string[];
  sun_sides?: string[];
}

export type { RoomTypeRow };
