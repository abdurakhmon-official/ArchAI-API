import { Injectable } from '@tsed/di';
import { badRequest, notFound } from '@/utils/errors';
import { Prisma } from '../generated/prisma';
import prisma from '@/modules/db';
import { PriceProfileInputSchema, type PriceProfileInput } from '@/inputs/price-profile.input';

/**
 * Foydalanuvchining o'z narxlari.
 *
 * Materiallar tanlovi loyihaga bog'langan edi: o'z pudratchisining
 * narxlarini biladigan odam har yangi loyihada ularni qaytadan
 * kiritardi.
 */

/** Bitta odamda cheksiz to'plam bo'lishining ma'nosi yo'q. */
const MAX_PROFILES = 10;

@Injectable()
export class PriceProfileService {
  async list(userId: string) {
    const items = await prisma.priceProfile.findMany({
      where: { user_id: userId },
      orderBy: { updated_at: 'desc' },
    });

    return { success: true, data: items };
  }

  async create(userId: string, input: PriceProfileInput) {
    const data = PriceProfileInputSchema.parse(input);

    const count = await prisma.priceProfile.count({ where: { user_id: userId } });
    if (count >= MAX_PROFILES) {
      throw badRequest('PRICE_PROFILE_LIMIT', `at most ${MAX_PROFILES} profiles can be kept`, { limit: MAX_PROFILES });
    }

    const item = await prisma.priceProfile.create({
      data: {
        user_id: userId,
        name: data.name,
        selection: data.selection as Prisma.InputJsonValue,
      },
    });

    return { success: true, _code: 'PRICE_PROFILE_SAVED', _message: 'prices saved', data: item };
  }

  async update(userId: string, id: string, input: PriceProfileInput) {
    const data = PriceProfileInputSchema.parse(input);
    await this.owned(userId, id);

    const item = await prisma.priceProfile.update({
      where: { id },
      data: { name: data.name, selection: data.selection as Prisma.InputJsonValue },
    });

    return { success: true, _code: 'PRICE_PROFILE_SAVED', _message: 'prices updated', data: item };
  }

  async remove(userId: string, id: string) {
    await this.owned(userId, id);
    await prisma.priceProfile.delete({ where: { id } });

    return { success: true, _code: 'PRICE_PROFILE_REMOVED', _message: 'profile removed' };
  }

  private async owned(userId: string, id: string) {
    const item = await prisma.priceProfile.findUnique({ where: { id } });

    if (!item) throw notFound('PRICE_PROFILE_NOT_FOUND', 'price profile not found');
    if (item.user_id !== userId) throw notFound('PRICE_PROFILE_NOT_FOUND', 'price profile not found');

    return item;
  }
}
