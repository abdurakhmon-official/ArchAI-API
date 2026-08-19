import { Req } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import type { Request } from 'express';
import { BodyParams, PathParams, QueryParams } from '@tsed/platform-params';
import { Delete, Get, Post, Put, Summary } from '@tsed/schema';
import { AdminOnly, Authorized } from '@/middlewares/auth.middleware';
import { RATE_LIMITS, RateLimit } from '@/middlewares/rate-limit.middleware';
import {
  ROOF_FAMILIES,
  type RoofStyleInput,
  type RoomTypeInput,
  type SkeletonInput,
  type StyleInput,
} from '@/inputs/catalog.input';
import { RoofStyleService } from '@/services/roof-style.service';
import { RoomTypeService } from '@/services/room-type.service';
import { SkeletonService } from '@/services/skeleton.service';
import { StyleService } from '@/services/style.service';

@Controller('/roof-styles')
export class RoofStyleController {
  @Inject()
  private roofStyleService!: RoofStyleService;

  @Get('/')
  async list() {
    return this.roofStyleService.listPublished();
  }

  @Get('/all')
  @Authorized(AdminOnly())
  async listAll() {
    return this.roofStyleService.listAll();
  }

  @Get('/families')
  async families() {
    return { success: true, data: ROOF_FAMILIES };
  }

  @Post('/')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async create(@Req() request: Request, @BodyParams() input: RoofStyleInput) {
    return this.roofStyleService.create(input, request.user!.id);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async update(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: Partial<RoofStyleInput>,
  ) {
    return this.roofStyleService.update(id, input, request.user!.id);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async delete(@Req() request: Request, @PathParams('id') id: string) {
    return this.roofStyleService.delete(id, request.user!.id);
  }
}

@Controller('/styles')
export class StyleController {
  @Inject()
  private styleService!: StyleService;

  @Get('/')
  async list() {
    return this.styleService.listPublished();
  }

  @Get('/all')
  @Authorized(AdminOnly())
  async listAll() {
    return this.styleService.listAll();
  }

  @Get('/:slug')
  async bySlug(@PathParams('slug') slug: string) {
    return this.styleService.bySlug(slug);
  }

  @Post('/')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async create(@Req() request: Request, @BodyParams() input: StyleInput) {
    return this.styleService.create(input, request.user!.id);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async update(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: StyleInput,
  ) {
    return this.styleService.update(id, input, request.user!.id);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async delete(@Req() request: Request, @PathParams('id') id: string) {
    return this.styleService.delete(id, request.user!.id);
  }
}

@Controller('/room-types')
export class RoomTypeController {
  @Inject()
  private roomTypeService!: RoomTypeService;

  @Get('/')
  async list() {
    return this.roomTypeService.list();
  }

  @Get('/selectable')
  async selectable() {
    return this.roomTypeService.selectable();
  }

  @Post('/')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async create(@Req() request: Request, @BodyParams() input: RoomTypeInput) {
    return this.roomTypeService.create(input, request.user!.id);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async update(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: RoomTypeInput,
  ) {
    return this.roomTypeService.update(id, input, request.user!.id);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async delete(@Req() request: Request, @PathParams('id') id: string) {
    return this.roomTypeService.delete(id, request.user!.id);
  }
}

@Controller('/skeletons')
export class SkeletonController {
  @Inject()
  private skeletonService!: SkeletonService;

  @Get('/')
  @Authorized(AdminOnly())
  async list(@QueryParams('drafts') drafts?: boolean) {
    return this.skeletonService.list(Boolean(drafts));
  }

  @Get('/published')
  async published() {
    return { success: true, data: await this.skeletonService.published() };
  }

  @Get('/:id')
  @Authorized(AdminOnly())
  async byId(@PathParams('id') id: string) {
    return this.skeletonService.byId(id);
  }

  @Post('/')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async create(@Req() request: Request, @BodyParams() input: SkeletonInput) {
    return this.skeletonService.create(input, request.user!.id);
  }

  @Post('/:id/duplicate')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async duplicate(@Req() request: Request, @PathParams('id') id: string) {
    return this.skeletonService.duplicate(id, request.user!.id);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async update(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: SkeletonInput,
  ) {
    return this.skeletonService.update(id, input, request.user!.id);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  @RateLimit(RATE_LIMITS.admin)
  async delete(@Req() request: Request, @PathParams('id') id: string) {
    return this.skeletonService.delete(id, request.user!.id);
  }
}
