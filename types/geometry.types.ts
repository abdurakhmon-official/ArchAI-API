import type { RoomTypeRule, ValidationResult } from '@/geometry/types';
import type { EstimateResult } from '@/shared/pricing';
import type { GeometryState } from '@/inputs/geometry.input';
import type { StyleConfig } from '@/types/style.types';

interface GeometryContext {
  rules: Record<string, RoomTypeRule>;
  names: Record<string, string>;
  style: StyleConfig;
}

interface GeometryOutcome {
  geometry: GeometryState;
  validation: ValidationResult;
  estimate: EstimateResult;
  coverSvg: string;
}

export type { GeometryContext, GeometryOutcome };
