import type { Job } from 'bullmq';
import { EXPORT_KIND } from '../../generated/prisma';
import { drawFloor, toSvg } from '@/geometry/drawing';
import { buildHouse, pickStairs } from '@/geometry/layout';
import type { Rect, TreeNode } from '@/geometry/types';
import prisma from '@/modules/db';
import { buildKey, putObject } from '@/modules/storage';
import type { PdfJob } from '@/modules/queue';
import { computeEstimate, type EstimateResult } from '@/services/estimate.service';
import { loadPriceBook } from '@/utils/price-book';
import { toConfig } from '@/utils/style-config';
import { toRule } from '@/utils/room-rule';
import { withPage } from '@/worker/lib/browser';
import { resolveLocale } from '@/i18n/locales';
import { renderProjectPdf, type PdfFloor } from '@/worker/templates/project-pdf';

const RETENTION_DAYS = 30;

export async function processPdf(job: Job<PdfJob>): Promise<{ key: string; cached: boolean }> {
  const { projectId, geometryHash, watermark, locale } = job.data;

  const existing = await prisma.projectExport.findUnique({
    where: {
      project_id_kind_geometry_hash_watermark: {
        project_id: projectId,
        kind: EXPORT_KIND.PDF,
        geometry_hash: geometryHash,
        watermark,
      },
    },
  });

  if (existing && (!existing.expires_at || existing.expires_at > new Date())) {
    return { key: existing.storage_key, cached: true };
  }

  await job.updateProgress(10);

  const project = await prisma.project.findUnique({
    where: { id: projectId },
    include: { style: { include: { roof_style: true } } },
  });

  if (!project || project.deleted_at) {
    throw new Error(`project not found: ${projectId}`);
  }

  const roomTypes = await prisma.roomType.findMany();

  const rules = Object.fromEntries(roomTypes.map((row) => [row.code, toRule(row)]));
  const names = Object.fromEntries(
    roomTypes.map((row) => {
      const name = row.name as Record<string, string | undefined>;
      return [row.code, name[locale] || name.uz || row.code];
    }),
  );

  await job.updateProgress(30);

  const geometry = project.geometry as unknown as {
    bounds: Rect;
    floors: Array<{ level: number; tree: TreeNode }>;
    extras?: Array<{ kind: string; count?: number }>;
  };

  const style = project.style ? toConfig(project.style) : null;
  const trees = [...geometry.floors]
    .sort((first, second) => first.level - second.level)
    .map((floor) => floor.tree);

  const stairs = trees.length > 1 ? pickStairs(trees[0], geometry.bounds) : undefined;

  const { house } = buildHouse(
    {
      bounds: geometry.bounds,
      floors: trees.map((tree, index) => ({ level: index + 1, tree, stairs })),
      roof: style?.roof,
      extras: geometry.extras as never,
    },
    { rules, layout: style?.layout },
  );

  await job.updateProgress(50);

  const floors: PdfFloor[] = house.floors.map((floor) => ({
    level: floor.level,
    svg: toSvg(drawFloor(floor, { names, extras: house.extras }), { scale: 30 }),
    rooms: floor.rooms.map((room) => ({
      roomType: room.roomType,
      label: room.label,
      area: room.area,
    })),
  }));

  const estimate =
    (project.estimate as unknown as EstimateResult | null) ??
    computeEstimate(house, await loadPriceBook(project.finish_level));

  const [finish, optionNames] = await Promise.all([
    prisma.finishLevel.findUnique({ where: { code: project.finish_level } }),
    optionNamesFor(estimate, locale),
  ]);

  const html = renderProjectPdf({
    locale: resolveLocale(locale),
    title: project.title,
    note: project.note,
    styleName: translated(project.style?.name, locale) || '',
    finishName: translated(finish?.name, locale) || project.finish_level,
    floors,
    estimate,
    names,
    optionNames,
    watermark,
    generatedAt: new Date(),
  });

  await job.updateProgress(65);

  const buffer = await withPage(async (page) => {
    await page.setContent(html, { waitUntil: 'load', timeout: 30_000 });
    await page.emulateMediaType('print');

    return Buffer.from(
      await page.pdf({
        format: 'A4',
        printBackground: true,
        preferCSSPageSize: true,
      }),
    );
  });

  await job.updateProgress(85);

  const key = buildKey('pdf', `${slugify(project.title)}.pdf`, `${geometryHash}${watermark ? '-w' : ''}`);
  await putObject(key, buffer, 'application/pdf');

  const expiresAt = new Date();
  expiresAt.setDate(expiresAt.getDate() + RETENTION_DAYS);

  await prisma.projectExport.upsert({
    where: {
      project_id_kind_geometry_hash_watermark: {
        project_id: projectId,
        kind: EXPORT_KIND.PDF,
        geometry_hash: geometryHash,
        watermark,
      },
    },
    update: { storage_key: key, size_bytes: buffer.byteLength, expires_at: expiresAt },
    create: {
      project_id: projectId,
      kind: EXPORT_KIND.PDF,
      storage_key: key,
      geometry_hash: geometryHash,
      watermark,
      size_bytes: buffer.byteLength,
      expires_at: expiresAt,
    },
  });

  await job.updateProgress(100);

  return { key, cached: false };
}

async function optionNamesFor(
  estimate: EstimateResult,
  locale: string,
): Promise<Record<string, Record<string, string>>> {
  const codes = [...new Set(estimate.lines.map((line) => line.optionCode).filter(Boolean))] as string[];
  if (codes.length === 0) return {};

  const options = await prisma.priceOption.findMany({
    where: { code: { in: codes } },
    select: { code: true, name: true, item: { select: { code: true } } },
  });

  const map: Record<string, Record<string, string>> = {};
  for (const option of options) {
    const itemCode = option.item.code;
    map[itemCode] ??= {};
    map[itemCode][option.code] = translated(option.name, locale) || option.code;
  }

  return map;
}

function translated(value: unknown, locale: string): string {
  if (typeof value === 'string') return value;
  const record = (value ?? {}) as Record<string, string | undefined>;
  return record[locale] || record.uz || record.en || '';
}

function slugify(value: string): string {
  return (
    value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'project'
  );
}
