import { Injectable } from '@tsed/di';
import { notFound } from '@/utils/errors';
import prisma from '@/modules/db';
import {
  FaqInputSchema,
  FaqReorderSchema,
  type FaqInput,
  type FaqReorder,
} from '@/inputs/content.input';

@Injectable()
export class FaqService {
  async list(includeInactive = false) {
    const items = await prisma.faqItem.findMany({
      where: includeInactive ? {} : { active: true },
      orderBy: [{ category: 'asc' }, { sort: 'asc' }],
    });

    const grouped = new Map<string, typeof items>();

    for (const item of items) {
      const list = grouped.get(item.category);
      if (list) list.push(item);
      else grouped.set(item.category, [item]);
    }

    return {
      success: true,
      data: [...grouped.entries()].map(([category, questions]) => ({ category, questions })),
      meta: { total: items.length, categories: grouped.size },
    };
  }

  async create(input: FaqInput) {
    const data = FaqInputSchema.parse(input);
    const item = await prisma.faqItem.create({ data });

    return { success: true, _code: 'FAQ_CREATED', _message: 'question added', data: item };
  }

  async update(id: string, input: FaqInput) {
    const data = FaqInputSchema.parse(input);

    const existing = await prisma.faqItem.findUnique({ where: { id } });
    if (!existing) throw notFound('FAQ_NOT_FOUND', 'faq item not found');

    const item = await prisma.faqItem.update({ where: { id }, data });
    return { success: true, _code: 'FAQ_UPDATED', _message: 'question updated', data: item };
  }

  async remove(id: string) {
    const existing = await prisma.faqItem.findUnique({ where: { id } });
    if (!existing) throw notFound('FAQ_NOT_FOUND', 'faq item not found');

    await prisma.faqItem.delete({ where: { id } });
    return { success: true, _code: 'FAQ_REMOVED', _message: 'question removed' };
  }

  async reorder(input: FaqReorder) {
    const { items } = FaqReorderSchema.parse(input);

    await prisma.$transaction(
      items.map((item) =>
        prisma.faqItem.update({ where: { id: item.id }, data: { sort: item.sort } }),
      ),
    );

    return { success: true, _code: 'FAQ_REORDERED', _message: 'order updated' };
  }
}
