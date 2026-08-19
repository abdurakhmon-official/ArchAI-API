import { Req } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { BodyParams } from '@tsed/platform-params';
import { Post, Returns, Summary } from '@tsed/schema';
import type { Request } from 'express';
import { OptionalAuth } from '@/middlewares/auth.middleware';
import { RateLimit, RATE_LIMITS } from '@/middlewares/rate-limit.middleware';
import type { GenerateInput } from '@/inputs/generation.input';
import { GenerationService } from '@/services/generation.service';
import { PlanService } from '@/services/plan.service';

@Controller('/generate')
export class GenerationController {
  @Inject()
  private generationService!: GenerationService;

  @Inject()
  private planService!: PlanService;

  @Post('/')
  @Returns(200)
  @(Returns(400).Description('invalid parameters, or the house does not fit the plot'))
  @OptionalAuth()
  @RateLimit(RATE_LIMITS.generate)
  async generate(@Req() request: Request, @BodyParams() input: GenerateInput) {
    const allowed = await this.variantAllowance(request);

    const result = await this.generationService.generate({
      ...input,
      variants: Math.min(input.variants ?? allowed, allowed),
    });

    return {
      success: true,
      data: result.variants,
      meta: {
        count: result.variants.length,
        relaxed: result.relaxed,
        message: result.message,
        variantLimit: allowed,
      },
    };
  }

  private async variantAllowance(request: Request): Promise<number> {
    if (!request.user) return 1;

    const plan = await this.planService.effectiveFor(request.user.id);
    return plan.limits.variants < 0 ? 6 : Math.max(1, plan.limits.variants);
  }
}
