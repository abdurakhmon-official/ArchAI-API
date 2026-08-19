import { extname } from 'node:path';
import { PlatformContext } from '@tsed/common';
import { Inject, Injectable, InjectContext } from '@tsed/di';
import { BadRequest, Forbidden, NotFound } from '@tsed/exceptions';
import type { Request } from 'express';
import type { PlatformMulterFile } from '@tsed/platform-multer';
import { PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { format } from 'date-fns';
import config from '@/config';
import { MEDIA_TYPE, USER_ROLE } from '../generated/prisma';
import {
  assetUrl,
  deleteObjects,
  objectSize,
  presignDownload,
  putObject,
  s3Client,
  storageDriver,
} from '@/modules/storage';
import { MediaService } from '@/services/media.service';
import { uuid } from '@/utils';
import {
  MAX_UPLOAD_BYTES,
  READABLE_ASSET_FOLDERS,
  ReadableAssetFolder,
  UPLOAD_FOLDERS,
  UPLOAD_MIME_TYPES,
  UploadFolder,
} from '@/utils/constants';

function readableLimit(): string {
  return `${Math.floor(MAX_UPLOAD_BYTES / (1024 * 1024))} MB`;
}

const DEFAULT_EXTENSIONS: Record<string, string> = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/gif': '.gif',
  'image/avif': '.avif',
  'model/gltf-binary': '.glb',
  'model/gltf+json': '.gltf',
  'application/pdf': '.pdf',
};

const UPLOAD_URL_EXPIRY = 15 * 60;

/* Folders any signed-in user may write to. Everything else is admin-only. */
const SELF_SERVICE_FOLDERS: UploadFolder[] = ['avatar'];

@Injectable()
export class S3Service {
  @Inject()
  private mediaService!: MediaService;

  @InjectContext()
  private context!: PlatformContext;

  private get user() {
    return this.context?.getRequest<Request>()?.user;
  }

  async sign(allParams: string[] | string, fileName?: string, attachment?: boolean) {
    const segments = this.assertReadableKey(allParams);
    const key = segments.join('/');

    return presignDownload(key, {
      attachment: Boolean(attachment),
      filename: fileName || segments[segments.length - 1],
    });
  }

  private assertReadableKey(allParams: string[] | string): string[] {
    const segments = (Array.isArray(allParams) ? allParams : [allParams]).flatMap((segment) =>
      String(segment ?? '').split('/'),
    );

    const malformed =
      segments.length < 2 ||
      !READABLE_ASSET_FOLDERS.includes(segments[0] as ReadableAssetFolder) ||
      segments.some(
        (segment) => !segment || segment === '.' || segment === '..' || /[\\\0]/.test(segment),
      );

    if (malformed) throw new NotFound('file not found');

    return segments;
  }

  async generatePolicy(folder: string, contentType: string, fileName: string, size: number) {
    this.assertFolder(folder);
    this.assertConfigured();

    const mimeType = decodeURIComponent(contentType || '').split(';')[0].trim().toLowerCase();
    if (!UPLOAD_MIME_TYPES[mimeType]) {
      throw new BadRequest(`unsupported file type: ${contentType}`);
    }

    const contentLength = Number(size);
    if (!Number.isInteger(contentLength) || contentLength <= 0) {
      throw new BadRequest('file size is required');
    }

    if (contentLength > MAX_UPLOAD_BYTES) {
      throw new BadRequest(`file is larger than ${readableLimit()}`);
    }

    const extension = extname(fileName || '').toLowerCase() || DEFAULT_EXTENSIONS[mimeType] || '';
    const key = `${folder}/${format(new Date(), 'yyyyMMdd')}/${uuid()}${extension}`;

    const command = new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET,
      Key: key,
      ContentType: mimeType,
      ContentLength: contentLength,
    });

    const uploadUrl = await getSignedUrl(s3Client(), command, {
      expiresIn: UPLOAD_URL_EXPIRY,
      signableHeaders: new Set(['content-length', 'content-type']),
    });

    return {
      success: true,
      data: {
        method: 'PUT' as const,
        uploadUrl,
        headers: { 'Content-Type': mimeType, 'Content-Length': String(contentLength) },
        key,
        url: assetUrl(key),
        expiresIn: UPLOAD_URL_EXPIRY,
        maxBytes: MAX_UPLOAD_BYTES,
      },
    };
  }

  async confirm(input: { key: string; originalName: string; mimeType: string; size: number }) {
    const [folder] = input.key.split('/');
    this.assertFolder(folder);

    const mimeType = input.mimeType.split(';')[0].trim().toLowerCase();
    const type = UPLOAD_MIME_TYPES[mimeType];

    if (!type) throw new BadRequest(`unsupported file type: ${input.mimeType}`);

    if (input.size > MAX_UPLOAD_BYTES) {
      throw new BadRequest(`file is larger than ${readableLimit()}`);
    }

    const actualSize = await objectSize(input.key);

    if (actualSize === null) {
      throw new BadRequest('file was not uploaded');
    }

    if (actualSize > MAX_UPLOAD_BYTES) {
      await deleteObjects([input.key]).catch(() => undefined);
      throw new BadRequest(`file is larger than ${readableLimit()}`);
    }

    const { data } = await this.mediaService.register({
      type: MEDIA_TYPE[type],
      url: assetUrl(input.key),
      key: input.key,
      originalName: input.originalName || input.key,
      mimeType,
      size: actualSize,
    });

    return { success: true, _code: 'FILE_REGISTERED', _message: 'file registered', data };
  }

  async upload(folder: string, file?: PlatformMulterFile) {
    if (!file) throw new BadRequest('file is required');

    this.assertFolder(folder);
    this.assertMayWrite(folder as UploadFolder);

    /*
      No S3 check here.

      `putObject` falls back to local disk when no bucket is set, so a
      direct upload works in development too. `generatePolicy` is
      different: a presigned POST only exists on S3, and it keeps the
      check.
    */
    const mimeType = file.mimetype?.split(';')[0].trim().toLowerCase() ?? '';
    const type = UPLOAD_MIME_TYPES[mimeType];

    if (!type) throw new BadRequest(`unsupported file type: ${file.mimetype}`);
    if (file.size > MAX_UPLOAD_BYTES) {
      throw new BadRequest(`file is larger than ${readableLimit()}`);
    }

    const extension =
      extname(file.originalname || '').toLowerCase() || DEFAULT_EXTENSIONS[mimeType] || '';
    const key = `${folder}/${format(new Date(), 'yyyyMMdd')}/${uuid()}${extension}`;

    await putObject(key, file.buffer, mimeType);

    const { data } = await this.mediaService.register({
      type: MEDIA_TYPE[type],
      url: assetUrl(key),
      key,
      originalName: file.originalname || key,
      mimeType,
      size: file.size,
    });

    return { success: true, _code: 'FILE_UPLOADED', _message: 'file uploaded', data };
  }

  putObject(key: string, body: Buffer, contentType?: string) {
    return putObject(key, body, contentType);
  }

  signUrl(key: string, options: { attachment?: boolean; expiresIn?: number; filename?: string } = {}) {
    return presignDownload(key, options);
  }

  deleteObjects(keys: string[]) {
    return deleteObjects(keys);
  }

  assetUrl(key: string) {
    return assetUrl(key);
  }

  private assertFolder(folder: string): void {
    if (!UPLOAD_FOLDERS.includes(folder as UploadFolder)) {
      throw new BadRequest(`folder must be one of: ${UPLOAD_FOLDERS.join(', ')}`);
    }
  }

  private assertMayWrite(folder: UploadFolder): void {
    if (SELF_SERVICE_FOLDERS.includes(folder)) return;
    if (this.user?.role === USER_ROLE.ADMIN) return;

    throw new Forbidden('admin access required');
  }

  private assertConfigured(): void {
    if (storageDriver() !== 's3') {
      throw new BadRequest('file storage is not configured on the server — set AWS_S3_BUCKET');
    }
  }
}
