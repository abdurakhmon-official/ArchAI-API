import { Req } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams, QueryParams } from '@tsed/platform-params';
import { Delete, Get, Patch, Post, Put, Summary } from '@tsed/schema';
import type { Request } from 'express';
import { AdminOnly, Authenticate, Authorized } from '@/middlewares/auth.middleware';
import { RequirePlan } from '@/middlewares/plan.middleware';
import type {
  CreateProjectInput,
  ListAllProjectsInput,
  ListProjectsInput,
  UpdateProjectInput,
  UpdateSelectionInput,
} from '@/inputs/project.input';
import { ProjectService } from '@/services/project.service';
import { PriceProfileService } from '@/services/price-profile.service';
import type { PriceProfileInput } from '@/inputs/price-profile.input';

@Controller('/projects')
export class ProjectController {
  @Inject()
  private projectService!: ProjectService;

  @Get('/')
  @Authorized(Authenticate())
  async list(@Req() request: Request, @QueryParams() query: ListProjectsInput) {
    return this.projectService.list(request.user!.id, query);
  }

  /*
    All projects — admin.

    Must be declared before `/:id`, otherwise Express reads `all` as an
    id and the request falls through to `byId`.
  */
  @Get('/all')
  @Authorized(AdminOnly())
  @Summary('All projects — admin')
  async listAll(@QueryParams() query: ListAllProjectsInput) {
    return this.projectService.listAll(query);
  }

  /*
    Ulashilgan loyiha — KIRISHSIZ.

    `/:id` dan oldin turishi shart: aks holda `shared` identifikator
    deb o'qilardi.
  */
  @Get('/shared/:token')
  async shared(@PathParams('token') token: string) {
    return this.projectService.byShareToken(token);
  }

  @Post('/:id/share')
  @Authorized(Authenticate())
  async share(@Req() request: Request, @PathParams('id') id: string) {
    return this.projectService.share(request.user!.id, id);
  }

  @Delete('/:id/share')
  @Authorized(Authenticate())
  async unshare(@Req() request: Request, @PathParams('id') id: string) {
    return this.projectService.unshare(request.user!.id, id);
  }

  @Get('/:id')
  @Authorized(Authenticate())
  async byId(@Req() request: Request, @PathParams('id') id: string) {
    return this.projectService.byId(request.user!.id, id, request.user!.isAdmin);
  }

  @Post('/')
  @Authorized(Authenticate())
  @RequirePlan('PROJECT_CREATE')
  async create(@Req() request: Request, @BodyParams() input: CreateProjectInput) {
    return this.projectService.create(request.user!.id, input);
  }

  @Patch('/:id')
  @Authorized(Authenticate())
  @RequirePlan('EDIT')
  async update(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: UpdateProjectInput,
  ) {
    return this.projectService.update(request.user!.id, id, input);
  }

  @Patch('/:id/estimate')
  @Authorized(Authenticate())
  async saveSelection(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: UpdateSelectionInput,
  ) {
    return this.projectService.saveSelection(request.user!.id, id, input);
  }

  @Get('/:id/versions')
  @Authorized(Authenticate())
  @RequirePlan('VERSIONS')
  async versions(@Req() request: Request, @PathParams('id') id: string) {
    return this.projectService.versions(request.user!.id, id);
  }

  @Post('/:id/versions/:versionId/restore')
  @Authorized(Authenticate())
  @RequirePlan('VERSIONS')
  async restoreVersion(
    @Req() request: Request,
    @PathParams('id') id: string,
    @PathParams('versionId') versionId: string,
  ) {
    return this.projectService.restoreVersion(request.user!.id, id, versionId);
  }

  @Post('/:id/pdf')
  @Authorized(Authenticate())
  @RequirePlan('PDF')
  async pdf(
    @Req() request: Request,
    @PathParams('id') id: string,
    @QueryParams('locale') locale?: string,
  ) {
    return this.projectService.requestPdf(request.user!.id, id, locale ?? 'uz');
  }

  @Post('/:id/render')
  @Authorized(Authenticate())
  async render(
    @Req() request: Request,
    @PathParams('id') id: string,
    @QueryParams('view') view?: 'exterior' | 'cutaway' | 'interior',
  ) {
    return this.projectService.requestRender(
      request.user!.id,
      id,
      view ?? 'exterior',
      request.user!.isAdmin,
    );
  }

  @Post('/:id/recalculate')
  @Authorized(Authenticate())
  async recalculate(@Req() request: Request, @PathParams('id') id: string) {
    return this.projectService.recalculate(request.user!.id, id);
  }

  @Delete('/:id')
  @Authorized(Authenticate())
  async delete(@Req() request: Request, @PathParams('id') id: string) {
    return this.projectService.delete(request.user!.id, id, request.user!.isAdmin);
  }

  @Post('/:id/restore')
  @Authorized(Authenticate())
  async restore(@Req() request: Request, @PathParams('id') id: string) {
    return this.projectService.restore(request.user!.id, id, request.user!.isAdmin);
  }
}

@Controller('/price-profiles')
export class PriceProfileController {
  @Inject()
  private profiles!: PriceProfileService;

  @Get('/')
  @Authorized(Authenticate())
  async list(@Req() request: Request) {
    return this.profiles.list(request.user!.id);
  }

  @Post('/')
  @Authorized(Authenticate())
  async create(@Req() request: Request, @BodyParams() input: PriceProfileInput) {
    return this.profiles.create(request.user!.id, input);
  }

  @Put('/:id')
  @Authorized(Authenticate())
  async update(
    @Req() request: Request,
    @PathParams('id') id: string,
    @BodyParams() input: PriceProfileInput,
  ) {
    return this.profiles.update(request.user!.id, id, input);
  }

  @Delete('/:id')
  @Authorized(Authenticate())
  async remove(@Req() request: Request, @PathParams('id') id: string) {
    return this.profiles.remove(request.user!.id, id);
  }
}
