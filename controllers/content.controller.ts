import { Req } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams, QueryParams } from '@tsed/platform-params';
import { Delete, Get, Post, Put, Summary } from '@tsed/schema';
import type { Request } from 'express';
import type { LEAD_STATUS } from '../generated/prisma';
import { AdminOnly, Authorized, OptionalAuth } from '@/middlewares/auth.middleware';
import { RateLimit, RATE_LIMITS } from '@/middlewares/rate-limit.middleware';
import type {
  BlogCategoryInput,
  BlogPostInput,
  FaqInput,
  FaqReorder,
  LeadInput,
  ListPostsInput,
  UpdateLeadInput,
} from '@/inputs/content.input';
import { BlogService } from '@/services/blog.service';
import { FaqService } from '@/services/faq.service';
import { LeadService } from '@/services/lead.service';

@Controller('/blog')
export class BlogController {
  @Inject()
  private blogService!: BlogService;

  @Get('/')
  @OptionalAuth()
  async list(@Req() request: Request, @QueryParams() query: ListPostsInput) {
    return this.blogService.list(query, Boolean(request.user?.isAdmin));
  }

  @Get('/categories')
  async categories() {
    return this.blogService.categories();
  }

  @Get('/:slug')
  @OptionalAuth()
  async bySlug(@Req() request: Request, @PathParams('slug') slug: string) {
    return this.blogService.bySlug(slug, Boolean(request.user?.isAdmin));
  }

  @Post('/')
  @Authorized(AdminOnly())
  async create(@Req() request: Request, @BodyParams() input: BlogPostInput) {
    return this.blogService.create(input, request.user!.id);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  async update(@PathParams('id') id: string, @BodyParams() input: BlogPostInput) {
    return this.blogService.update(id, input);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  async remove(@PathParams('id') id: string) {
    return this.blogService.remove(id);
  }

  @Post('/categories')
  @Authorized(AdminOnly())
  async createCategory(@BodyParams() input: BlogCategoryInput) {
    return this.blogService.createCategory(input);
  }

  @Delete('/categories/:id')
  @Authorized(AdminOnly())
  async removeCategory(@PathParams('id') id: string) {
    return this.blogService.removeCategory(id);
  }
}

@Controller('/faq')
export class FaqController {
  @Inject()
  private faqService!: FaqService;

  @Get('/')
  @OptionalAuth()
  async list(@Req() request: Request) {
    return this.faqService.list(Boolean(request.user?.isAdmin));
  }

  @Post('/')
  @Authorized(AdminOnly())
  async create(@BodyParams() input: FaqInput) {
    return this.faqService.create(input);
  }

  @Put('/reorder')
  @Authorized(AdminOnly())
  async reorder(@BodyParams() items: FaqReorder) {
    return this.faqService.reorder(items);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  async update(@PathParams('id') id: string, @BodyParams() input: FaqInput) {
    return this.faqService.update(id, input);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  async remove(@PathParams('id') id: string) {
    return this.faqService.remove(id);
  }
}

@Controller('/leads')
export class LeadController {
  @Inject()
  private leadService!: LeadService;

  @Post('/')
  @RateLimit(RATE_LIMITS.lead)
  async create(@BodyParams() input: LeadInput) {
    return this.leadService.create(input);
  }

  @Get('/')
  @Authorized(AdminOnly())
  async list(
    @QueryParams('page') page?: number,
    @QueryParams('limit') limit?: number,
    @QueryParams('status') status?: LEAD_STATUS,
  ) {
    return this.leadService.list({ page, limit, status });
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  async update(@PathParams('id') id: string, @BodyParams() input: UpdateLeadInput) {
    return this.leadService.update(id, input);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  async remove(@PathParams('id') id: string) {
    return this.leadService.remove(id);
  }
}
