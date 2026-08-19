import { Req } from '@tsed/common';
import { useDecorators } from '@tsed/core';
import { Inject } from '@tsed/di';
import { Forbidden, Unauthorized } from '@tsed/exceptions';
import { Middleware, MiddlewareMethods, UseAuth } from '@tsed/platform-middlewares';
import { Context } from '@tsed/platform-params';
import { Returns } from '@tsed/schema';
import type { Request } from 'express';
import { PlanService } from '@/services/plan.service';
import type { MessageCode } from '@/utils/messages';
import { isUnlimited } from '@/utils/plan';

export type PlanFeature = 'PROJECT_CREATE' | 'PDF' | 'EDIT' | 'INTERIOR' | 'VERSIONS';

export interface PlanRequirement {
  feature: PlanFeature;
}

export class PlanLimitException extends Forbidden {
  readonly code = 'PLAN_LIMIT';

  constructor(
    readonly _code: MessageCode,
    message: string,
    readonly meta: { feature: PlanFeature; plan: string; limit?: number; current?: number },
  ) {
    super(message);
  }
}

@Middleware()
export class PlanMiddleware implements MiddlewareMethods {
  @Inject()
  private planService!: PlanService;

  async use(@Req() request: Req, @Context() ctx: Context) {
    const requirement: PlanRequirement | undefined = ctx.endpoint.get(PlanMiddleware);
    if (!requirement) return true;

    const user = (request as unknown as Request).user;
    if (!user) throw new Unauthorized('Unauthorized');

    if (user.isAdmin) return true;

    const plan = await this.planService.effectiveFor(user.id);

    switch (requirement.feature) {
      case 'PROJECT_CREATE': {
        if (isUnlimited(plan.limits.projects)) return true;

        const current = await this.planService.projectCount(user.id);
        if (current < plan.limits.projects) return true;

        throw new PlanLimitException(
          'PLAN_PROJECT_LIMIT',
          `the ${plan.code} plan holds ${plan.limits.projects} projects`,
          { feature: requirement.feature, plan: plan.code, limit: plan.limits.projects, current },
        );
      }

      case 'PDF':
        if (plan.limits.pdf) return true;
        throw new PlanLimitException(
          'PLAN_NO_PDF',
          `PDF download is not part of the ${plan.code} plan`,
          { feature: requirement.feature, plan: plan.code },
        );

      case 'EDIT':
        if (plan.limits.edit) return true;
        throw new PlanLimitException(
          'PLAN_NO_EDIT',
          `editing a project is not part of the ${plan.code} plan`,
          { feature: requirement.feature, plan: plan.code },
        );

      case 'INTERIOR':
        if (plan.limits.interior) return true;
        throw new PlanLimitException(
          'PLAN_NO_INTERIOR',
          `the interior view is not part of the ${plan.code} plan`,
          { feature: requirement.feature, plan: plan.code },
        );

      case 'VERSIONS':
        if (isUnlimited(plan.limits.versions) || plan.limits.versions > 0) return true;
        throw new PlanLimitException(
          'PLAN_NO_VERSIONS',
          `version history is not part of the ${plan.code} plan`,
          { feature: requirement.feature, plan: plan.code },
        );

      default:
        return true;
    }
  }
}

export function RequirePlan(feature: PlanFeature): Function {
  return useDecorators(
    UseAuth(PlanMiddleware, { feature }),
    Returns(403).Description('plan limit reached — the body carries `code: PLAN_LIMIT` and the plan detail'),
  );
}
