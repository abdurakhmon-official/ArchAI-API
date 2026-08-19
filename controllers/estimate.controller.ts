import { Req } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams } from '@tsed/platform-params';
import { Delete, Get, Post, Put, Summary } from '@tsed/schema';
import type { Request } from 'express';
import {
  EstimateInputSchema,
  type EstimateInput,
  type FinishLevelInput,
  type PriceItemInput,
  type PriceOptionInput,
} from '@/inputs/estimate.input';
import { AdminOnly, Authorized } from '@/middlewares/auth.middleware';
import { RateLimit, RATE_LIMITS } from '@/middlewares/rate-limit.middleware';
import { EstimateService } from '@/services/estimate.service';
import { GeometryService } from '@/services/geometry.service';
import { PriceService } from '@/services/price.service';

@Controller('/estimate')
export class EstimateController {
  @Inject()
  private estimateService!: EstimateService;

  @Inject()
  private geometryService!: GeometryService;

  @Inject()
  private priceService!: PriceService;

  @Post('/')
  @RateLimit(RATE_LIMITS.estimate)
  async calculate(@BodyParams() body: EstimateInput) {
    const input = EstimateInputSchema.parse(body);

    const context = await this.geometryService.context(input.geometry.styleSlug);
    const house = this.geometryService.toHouse(input.geometry, context);

    const estimate = await this.estimateService.forHouse(house, input.finishLevel, input.selection);

    return { success: true, data: estimate };
  }

  @Get('/finish-levels')
  async finishLevels() {
    return this.priceService.listFinishLevels();
  }

  @Get('/price-items')
  async priceItems() {
    return this.priceService.listItems();
  }
}

@Controller('/price-items')
export class PriceAdminController {
  @Inject()
  private priceService!: PriceService;

  @Get('/')
  @Authorized(AdminOnly())
  async list() {
    return this.priceService.listAll();
  }

  @Get('/impact')
  @Authorized(AdminOnly())
  async impact() {
    return this.priceService.impact();
  }

  @Post('/')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async create(@Req() request: Request, @BodyParams() input: PriceItemInput) {
    return this.priceService.createItem(input, request.user!.id);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async update(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: Partial<PriceItemInput>,
  ) {
    return this.priceService.updateItem(id, input, request.user!.id);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async deactivate(@Req() request: Request, @PathParams('id') id: string) {
    return this.priceService.deactivateItem(id, request.user!.id);
  }

  @Post('/:id/options')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async createOption(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: PriceOptionInput,
  ) {
    return this.priceService.createOption(id, input, request.user!.id);
  }

  @Put('/options/:optionId')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async updateOption(
    @Req() request: Request,
    @PathParams('optionId') optionId: string,
    @BodyParams() input: Partial<PriceOptionInput>,
  ) {
    return this.priceService.updateOption(optionId, input, request.user!.id);
  }

  @Delete('/options/:optionId')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async deleteOption(@Req() request: Request, @PathParams('optionId') optionId: string) {
    return this.priceService.deleteOption(optionId, request.user!.id);
  }
}

@Controller('/finish-levels')
export class FinishLevelController {
  @Inject()
  private priceService!: PriceService;

  @Get('/')
  async list() {
    return this.priceService.listFinishLevels();
  }

  @Put('/:code')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async update(
    @Req() request: Request,
    @PathParams('code') code: string,
    @BodyParams() input: FinishLevelInput,
  ) {
    return this.priceService.updateFinishLevel(code, input, request.user!.id);
  }
}
