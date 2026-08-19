interface PlanLimits {
  projects: number;
  variants: number;
  versions: number;
  pdf: boolean;
  dwg: boolean | 'on_request';
  interior: boolean;
  edit: boolean;
  watermark: boolean;
}

interface EffectivePlan {
  code: string;
  limits: PlanLimits;
  expiresAt: Date | null;
}

export type { PlanLimits, EffectivePlan };
