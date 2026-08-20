import { Injectable } from '@tsed/di';
import { badRequest, notFound } from '@/utils/errors';
import { PRICE_CATEGORY, Prisma } from '../generated/prisma';
import prisma from '@/modules/db';
import {
  FinishLevelInputSchema,
  PriceItemInputSchema,
  PriceOptionInputSchema,
  type FinishLevelInput,
  type PriceItemInput,
  type PriceOptionInput,
} from '@/inputs/estimate.input';
import { diffOf, recordAudit } from '@/utils/audit';
import type { PriceBook, PriceCategory } from '@/shared/pricing';
import { loadPriceBook } from '@/utils/price-book';
import { toPlain, jsonOrNull } from '@/utils/prisma-json';

export type {
  PriceBook,
  PriceCategory,
  PriceLine,
  PriceOptionLine,
} from '@/shared/pricing';

type MissingInShared = Exclude<PRICE_CATEGORY, PriceCategory>;
type MissingInPrisma = Exclude<PriceCategory, PRICE_CATEGORY>;
const _categoriesMatch: MissingInShared | MissingInPrisma extends never ? true : never = true;
void _categoriesMatch;

@Injectable()
export class PriceService {
  async listItems() {
    const items = await prisma.priceItem.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { sort: 'asc' }],
      include: { options: { where: { active: true }, orderBy: { sort: 'asc' } } },
    });

    return { success: true, data: items };
  }

  async listFinishLevels() {
    const items = await prisma.finishLevel.findMany({ orderBy: { sort: 'asc' } });
    return { success: true, data: items };
  }

  book(finishLevel: string): Promise<PriceBook> {
    return loadPriceBook(finishLevel);
  }

  async listAll() {
    const items = await prisma.priceItem.findMany({
      orderBy: [{ category: 'asc' }, { sort: 'asc' }],
      include: { options: { orderBy: { sort: 'asc' } } },
    });

    return { success: true, data: items };
  }

  async createItem(input: PriceItemInput, actorId: string | null = null) {
    const data = PriceItemInputSchema.parse(input);

    const clash = await prisma.priceItem.findUnique({ where: { code: data.code } });
    if (clash) throw badRequest('CODE_TAKEN', 'this code is already taken');

    const item = await prisma.priceItem.create({ data });
    await recordAudit({ actorId, action: 'create', entity: 'price_item', entityId: item.id });

    return { success: true, _code: 'PRICE_ITEM_ADDED', _message: 'price item added', data: item };
  }

  async updateItem(id: string, input: Partial<PriceItemInput>, actorId: string | null = null) {
    const data = PriceItemInputSchema.partial().parse(input);

    const existing = await prisma.priceItem.findUnique({ where: { id } });
    if (!existing) throw notFound('PRICE_ITEM_NOT_FOUND', 'price item not found');

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.priceItem.findUnique({ where: { code: data.code } });
      if (clash && clash.id !== id) throw badRequest('CODE_TAKEN', 'this code is already taken');
    }

    const item = await prisma.priceItem.update({ where: { id }, data });
    await recordAudit({
      actorId,
      action: 'update',
      entity: 'price_item',
      entityId: id,
      diff: diffOf(toPlain(existing), toPlain(item)),
    });

    return { success: true, _code: 'PRICE_SAVED', _message: 'saved', data: item };
  }

  async deactivateItem(id: string, actorId: string | null = null) {
    const existing = await prisma.priceItem.findUnique({ where: { id } });
    if (!existing) throw notFound('PRICE_ITEM_NOT_FOUND', 'price item not found');

    const item = await prisma.priceItem.update({ where: { id }, data: { active: false } });
    await recordAudit({ actorId, action: 'archive', entity: 'price_item', entityId: id });

    return { success: true, _code: 'PRICE_ITEM_REMOVED', _message: 'price item removed', data: item };
  }

  async createOption(itemId: string, input: PriceOptionInput, actorId: string | null = null) {
    const data = PriceOptionInputSchema.parse(input);

    const item = await prisma.priceItem.findUnique({ where: { id: itemId } });
    if (!item) throw notFound('PRICE_ITEM_NOT_FOUND', 'price item not found');

    const clash = await prisma.priceOption.findUnique({
      where: { priceItemId_code: { priceItemId: itemId, code: data.code } },
    });
    if (clash) throw badRequest('PRICE_OPTION_CODE_TAKEN', 'this material code already exists on that item');

    const option = await prisma.priceOption.create({
      data: { ...data, description: jsonOrNull(data.description), priceItemId: itemId },
    });
    await recordAudit({
      actorId,
      action: 'create',
      entity: 'price_option',
      entityId: option.id,
      diff: { item: item.code, option: data.code },
    });

    return { success: true, _code: 'PRICE_OPTION_ADDED', _message: 'material added', data: option };
  }

  async updateOption(id: string, input: Partial<PriceOptionInput>, actorId: string | null = null) {
    const data = PriceOptionInputSchema.partial().parse(input);

    const existing = await prisma.priceOption.findUnique({ where: { id } });
    if (!existing) throw notFound('PRICE_OPTION_NOT_FOUND', 'material not found');

    const option = await prisma.priceOption.update({
      where: { id },
      data: { ...data, description: jsonOrNull(data.description) },
    });
    await recordAudit({
      actorId,
      action: 'update',
      entity: 'price_option',
      entityId: id,
      diff: diffOf(toPlain(existing), toPlain(option)),
    });

    return { success: true, _code: 'PRICE_SAVED', _message: 'saved', data: option };
  }

  async deleteOption(id: string, actorId: string | null = null) {
    const existing = await prisma.priceOption.findUnique({ where: { id } });
    if (!existing) throw notFound('PRICE_OPTION_NOT_FOUND', 'material not found');

    const affected = await this.projectsUsingOption(existing.priceItemId, existing.code);

    await prisma.priceOption.delete({ where: { id } });
    await recordAudit({
      actorId,
      action: 'delete',
      entity: 'price_option',
      entityId: id,
      diff: { code: existing.code, affectedProjects: affected },
    });

    return {
      success: true,
      _code: 'PRICE_OPTION_REMOVED',
      _message:
        affected > 0
          ? `material removed, ${affected} projects fall back to the default price`
          : 'material removed',
      meta: { count: affected },
    };
  }

  async updateFinishLevel(code: string, input: FinishLevelInput, actorId: string | null = null) {
    const data = FinishLevelInputSchema.parse(input);

    const existing = await prisma.finishLevel.findUnique({ where: { code } });
    if (!existing) throw notFound('PRICE_FINISH_NOT_FOUND', 'finish level not found');

    const unknown = await this.unknownOptions(data.defaults);
    if (unknown.length > 0) {
      throw badRequest('PRICE_MATERIAL_UNKNOWN', `unknown materials: ${unknown.join(', ')}`, { codes: unknown.join(', ') });
    }

    const level = await prisma.finishLevel.update({ where: { code }, data });
    await recordAudit({
      actorId,
      action: 'update',
      entity: 'finishLevel',
      entityId: existing.id,
      diff: diffOf(toPlain(existing), toPlain(level)),
    });

    return { success: true, _code: 'PRICE_SAVED', _message: 'saved', data: level };
  }

  async impact() {
    const [total, withSelection] = await prisma.$transaction([
      prisma.project.count({ where: { deletedAt: null } }),
      prisma.project.count({
        where: { deletedAt: null, estimateSelection: { not: Prisma.DbNull } },
      }),
    ]);

    return {
      success: true,
      data: {
        projects: total,
        withOwnSelection: withSelection,
      },
    };
  }

  private async projectsUsingOption(itemId: string, optionCode: string): Promise<number> {
    const item = await prisma.priceItem.findUnique({ where: { id: itemId } });
    if (!item) return 0;

    return prisma.project.count({
      where: {
        deletedAt: null,
        estimateSelection: { path: [item.code, 'optionCode'], equals: optionCode },
      },
    });
  }

  private async unknownOptions(defaults: Record<string, string>): Promise<string[]> {
    const items = await prisma.priceItem.findMany({
      where: { code: { in: Object.keys(defaults) } },
      include: { options: true },
    });

    const byCode = new Map(items.map((item) => [item.code, item]));
    const missing: string[] = [];

    for (const [itemCode, optionCode] of Object.entries(defaults)) {
      const item = byCode.get(itemCode);
      if (!item) {
        missing.push(`${itemCode} (no such price item)`);
        continue;
      }

      if (!item.options.some((option) => option.code === optionCode)) {
        missing.push(`${itemCode} → ${optionCode}`);
      }
    }

    return missing;
  }
}
