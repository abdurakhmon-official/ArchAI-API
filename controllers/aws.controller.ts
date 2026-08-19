import type { Response } from 'express';
import { Res } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { MulterOptions, MultipartFile, type PlatformMulterFile } from '@tsed/platform-multer';
import { BodyParams, PathParams, QueryParams } from '@tsed/platform-params';
import { Delete, Get, Post, Summary } from '@tsed/schema';
import { AdminOnly, Authenticate, Authorized } from '@/middlewares/auth.middleware';
import { RateLimit, RATE_LIMITS } from '@/middlewares/rate-limit.middleware';
import { ConfirmUploadInputSchema, type ConfirmUploadInput } from '@/inputs/media.input';
import { MediaService } from '@/services/media.service';
import { S3Service } from '@/services/s3.service';
import { MAX_UPLOAD_BYTES } from '@/utils/constants';
import { ExportAdminService } from '@/services/export-admin.service';

@Controller('/s3')
export class AwsController {
  @Inject()
  private s3Service!: S3Service;

  @Inject()
  private mediaService!: MediaService;

  @Get('/file/*key')
  async sign(
    @PathParams('key') allParams: string[],
    @QueryParams('attachment') attachment: boolean,
    @QueryParams('fileName') fileName: string,
    @Res() res: Response,
  ) {
    const url = await this.s3Service.sign(allParams, fileName, attachment);
    res.redirect(url);
  }

  @Get('/generate-policy')
  @Authorized(Authenticate())
  @RateLimit(RATE_LIMITS.upload)
  async generatePolicy(
    @QueryParams('folder') folder: string,
    @QueryParams('contentType') contentType: string,
    @QueryParams('filename') filename: string,
    @QueryParams('size') size: number,
  ) {
    return this.s3Service.generatePolicy(folder, contentType, filename, Number(size));
  }

  @Post('/confirm')
  @Authorized(Authenticate())
  async confirm(@BodyParams() body: ConfirmUploadInput) {
    const input = ConfirmUploadInputSchema.parse(body);
    return this.s3Service.confirm(input);
  }

  @Post('/:folder/upload')
  @Authorized(Authenticate())
  @RateLimit(RATE_LIMITS.upload)
  @MulterOptions({ limits: { fileSize: MAX_UPLOAD_BYTES, files: 1 } })
  async upload(
    @PathParams('folder') folder: string,
    @MultipartFile('file') file: PlatformMulterFile,
  ) {
    return this.s3Service.upload(folder, file);
  }

  @Get('/media')
  @Authorized(AdminOnly())
  async list(
    @QueryParams('page') page?: number,
    @QueryParams('limit') limit?: number,
    @QueryParams('type') type?: 'IMAGE' | 'MODEL' | 'DOCUMENT',
    @QueryParams('search') search?: string,
  ) {
    return this.mediaService.list({ page, limit, type, search });
  }

  @Get('/media/orphans')
  @Authorized(AdminOnly())
  async orphans(@QueryParams('days') days?: number) {
    return this.mediaService.findOrphans(days ?? 7);
  }

  @Delete('/media/orphans')
  @Authorized(AdminOnly())
  async purgeOrphans(@QueryParams('days') days?: number) {
    return this.mediaService.purgeOrphans(days ?? 7);
  }

  @Delete('/media/:id')
  @Authorized(Authenticate())
  async remove(@PathParams('id') id: string) {
    return this.mediaService.remove(id);
  }
}

/**
 * Loyiha eksportlari — PDF va 3D rasmlar.
 *
 * Media kutubxonasidan alohida: bular kesh va 30 kundan keyin o'zi
 * o'chadi (`ExportAdminService` izohiga qarang).
 */
@Controller('/exports')
export class ExportAdminController {
  @Inject()
  private exports!: ExportAdminService;

  @Get('/')
  @Authorized(AdminOnly())
  async list(
    @QueryParams('page') page?: number,
    @QueryParams('limit') limit?: number,
    @QueryParams('kind') kind?: 'PDF' | 'RENDER' | 'DWG',
    @QueryParams('search') search?: string,
  ) {
    return this.exports.list({ page, limit, kind: kind as never, search });
  }

  @Delete('/expired')
  @Authorized(AdminOnly())
  async purge() {
    return this.exports.purgeExpired();
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  async remove(@PathParams('id') id: string) {
    return this.exports.remove(id);
  }
}
