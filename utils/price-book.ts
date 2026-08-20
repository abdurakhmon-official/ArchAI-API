import { notFound } from '@/utils/errors';
import prisma from '@/modules/db';
import type { PriceBook } from '@/shared/pricing';

async function loadPriceBook(finishLevel: string): Promise<PriceBook> {
  const [items, finish] = await Promise.all([
    prisma.priceItem.findMany({
      where: { active: true },
      orderBy: [{ category: 'asc' }, { sort: 'asc' }],
      include: {
        options: {
          where: { active: true },
          orderBy: { sort: 'asc' },
        },
      },
    }),
    prisma.finishLevel.findUnique({ where: { code: finishLevel } }),
  ]);

  if (!finish) throw notFound('PRICE_FINISH_NOT_FOUND', `unknown finish level: ${finishLevel}`);

  return {
    lines: items.map((item) => ({
      code: item.code,
      category: item.category,
      name: item.name,
      unit: item.unit,
      unitPrice: Number(item.unitPrice),
      measure: item.measure,
      sort: item.sort,
      options: item.options.map((option) => ({
        code: option.code,
        name: option.name,
        description: option.description,
        unitPrice: Number(option.unitPrice),
        imageUrl: option.imageUrl,
        sort: option.sort,
      })),
    })),
    finishDefaults: (finish.defaults ?? {}) as Record<string, string>,
    finishLevel,
  };
}

export { loadPriceBook };
