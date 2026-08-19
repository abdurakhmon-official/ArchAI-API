import { existsSync, mkdirSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  DeleteObjectsCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import config from '@/config';

const S3_DELETE_BATCH = 1000;

export const LOCAL_STORAGE_DIR = resolve(process.cwd(), 'storage');

const useS3 = Boolean(config.AWS_S3_BUCKET);

const client = useS3
  ? new S3Client({
      region: config.AWS_REGION,
      ...(config.AWS_ACCESS_KEY_ID && config.AWS_SECRET_ACCESS_KEY
        ? {
            credentials: {
              accessKeyId: config.AWS_ACCESS_KEY_ID,
              secretAccessKey: config.AWS_SECRET_ACCESS_KEY,
            },
          }
        : {}),
    })
  : null;

export function storageDriver(): 's3' | 'local' {
  return useS3 ? 's3' : 'local';
}

export function s3Client(): S3Client {
  if (!client) throw new Error('S3 is not configured — set AWS_S3_BUCKET');
  return client;
}

export async function putObject(key: string, body: Buffer, contentType?: string): Promise<string> {
  if (!client) {
    const path = join(LOCAL_STORAGE_DIR, key);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, body);
    return key;
  }

  await client.send(
    new PutObjectCommand({
      Bucket: config.AWS_S3_BUCKET,
      Key: key,
      Body: body,
      ...(contentType ? { ContentType: contentType } : {}),
    }),
  );

  return key;
}

export async function presignDownload(
  key: string,
  options: { expiresIn?: number; attachment?: boolean; filename?: string } = {},
): Promise<string> {
  if (!client) return `${config.publicApiUrl}/static/${key}`;

  const command = new GetObjectCommand({
    Bucket: config.AWS_S3_BUCKET,
    Key: key,
    ...(options.attachment
      ? { ResponseContentDisposition: `attachment; filename="${safeFilename(options.filename)}"` }
      : {}),
  });

  return getSignedUrl(client, command, {
    expiresIn: options.expiresIn ?? config.AWS_FILE_VIEW_EXPIRY_SECONDS,
  });
}

export async function deleteObjects(keys: string[]): Promise<number> {
  const unique = [...new Set(keys.filter(Boolean))];
  if (unique.length === 0) return 0;

  if (!client) {
    for (const key of unique) {
      const path = join(LOCAL_STORAGE_DIR, key);
      if (existsSync(path)) rmSync(path, { force: true });
    }
    return unique.length;
  }

  for (let index = 0; index < unique.length; index += S3_DELETE_BATCH) {
    const chunk = unique.slice(index, index + S3_DELETE_BATCH);

    await client.send(
      new DeleteObjectsCommand({
        Bucket: config.AWS_S3_BUCKET,
        Delete: { Objects: chunk.map((Key) => ({ Key })), Quiet: true },
      }),
    );
  }

  return unique.length;
}

export async function deleteObject(key: string): Promise<void> {
  await deleteObjects([key]);
}

export async function objectSize(key: string): Promise<number | null> {
  if (!client) {
    const path = join(LOCAL_STORAGE_DIR, key);
    return existsSync(path) ? statSync(path).size : null;
  }

  try {
    const head = await client.send(
      new HeadObjectCommand({ Bucket: config.AWS_S3_BUCKET, Key: key }),
    );

    return head.ContentLength ?? null;
  } catch {
    return null;
  }
}
export function assetUrl(key: string): string {
  const path = key
    .split('/')
    .map((segment) => encodeURIComponent(segment))
    .join('/');

  return `${config.publicApiUrl}/s3/file/${path}`;
}

export function buildKey(folder: string, filename: string, unique: string): string {
  const year = new Date().getFullYear();
  const safe = filename
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return `${folder}/${year}/${unique}-${safe}`;
}

export function safeFilename(filename?: string): string {
  const cleaned = (filename || '')
    .replace(/[\r\n"\\]/g, '')
    .replace(/[\x00-\x1f\x7f]/g, '')
    .trim()
    .slice(0, 200);

  return cleaned || 'download';
}
