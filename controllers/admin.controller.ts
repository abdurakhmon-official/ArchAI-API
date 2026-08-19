import { Req } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams, QueryParams } from '@tsed/platform-params';
import { Delete, Get, Post, Put, Summary } from '@tsed/schema';
import type { Request } from 'express';
import type { AuditQuery } from '@/inputs/audit.input';
import type { PlanInput } from '@/inputs/billing.input';
import { AdminOnly, Authorized } from '@/middlewares/auth.middleware';
import { RATE_LIMITS, RateLimit } from '@/middlewares/rate-limit.middleware';
import { AuditService } from '@/services/audit.service';
import { PlanService } from '@/services/plan.service';

@Controller('/audit')
export class AuditController {
  @Inject()
  private auditService!: AuditService;

  @Get('/')
  @Authorized(AdminOnly())
  async list(@QueryParams() query: AuditQuery) {
    return this.auditService.list(query);
  }

  @Get('/facets')
  @Authorized(AdminOnly())
  async facets() {
    return this.auditService.facets();
  }
}

@Controller('/plans')
export class PlanAdminController {
  @Inject()
  private planService!: PlanService;

  @Get('/')
  @Authorized(AdminOnly())
  async list() {
    return this.planService.listAll();
  }

  @Get('/subscriptions')
  @Authorized(AdminOnly())
  async subscriptions(@QueryParams('page') page?: number, @QueryParams('limit') limit?: number) {
    return this.planService.subscriptions(Number(page) || 1, Number(limit) || 30);
  }

  @Post('/')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async create(@Req() request: Request, @BodyParams() input: PlanInput) {
    return this.planService.create(input, request.user!.id);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async update(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: Partial<PlanInput>,
  ) {
    return this.planService.update(id, input, request.user!.id);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async deactivate(@Req() request: Request, @PathParams('id') id: string) {
    return this.planService.deactivate(id, request.user!.id);
  }
}
