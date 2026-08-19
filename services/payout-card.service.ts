import { Injectable } from '@tsed/di';
import { conflict, notFound } from '@/utils/errors';
import prisma from '@/modules/db';
import { PayoutCardInputSchema, type PayoutCardInput } from '@/inputs/billing.input';
import { recordAudit } from '@/utils/audit';

/**
 * Admin obuna to'lovlari qaysi hisobga (karta/merchant account) tushishini
 * boshqaradi.
 *
 * To'liq karta raqami hech qachon bazada saqlanmaydi — faqat oxirgi 4
 * raqam (PCI DSS). Har provayder uchun bittagina faol karta bo'lishi
 * shart: yangisini faollashtirish eskisini bir tranzaksiyada o'chiradi,
 * shunda ikkalasi bir vaqtda faol bo'lib qolmaydi.
 *
 * Jurnalga faqat `last4` yoziladi — egasi, hisob identifikatori va
 * muddati auditga tushmaydi.
 */
@Injectable()
export class PayoutCardService {
  async list() {
    const cards = await prisma.payoutCard.findMany({
      orderBy: [{ provider: 'asc' }, { created_at: 'desc' }],
    });

    return { success: true, data: cards };
  }

  async create(input: PayoutCardInput, actorId: string | null) {
    const data = PayoutCardInputSchema.parse(input);

    const card = await prisma.payoutCard.create({
      data: { ...data, active: false, created_by: actorId },
    });

    await recordAudit({
      actorId,
      action: 'create',
      entity: 'payout_card',
      entityId: card.id,
      diff: { last4: { from: null, to: card.last4 } },
    });

    return {
      success: true,
      _code: 'PAYOUT_CARD_CREATED',
      _message: 'payout card added',
      data: card,
    };
  }

  async update(id: string, input: Partial<PayoutCardInput>, actorId: string | null) {
    const { provider: _ignored, ...editable } = input;
    const data = PayoutCardInputSchema.omit({ provider: true }).partial().parse(editable);

    const existing = await prisma.payoutCard.findUnique({ where: { id } });
    if (!existing) throw notFound('PAYOUT_CARD_NOT_FOUND', 'payout card not found');

    const card = await prisma.payoutCard.update({ where: { id }, data });

    await recordAudit({
      actorId,
      action: 'update',
      entity: 'payout_card',
      entityId: id,
      diff: { last4: { from: existing.last4, to: card.last4 } },
    });

    return {
      success: true,
      _code: 'PAYOUT_CARD_UPDATED',
      _message: 'payout card updated',
      data: card,
    };
  }

  async activate(id: string, actorId: string | null) {
    const existing = await prisma.payoutCard.findUnique({ where: { id } });
    if (!existing) throw notFound('PAYOUT_CARD_NOT_FOUND', 'payout card not found');

    if (existing.active) {
      return {
        success: true,
        _code: 'PAYOUT_CARD_ACTIVATED',
        _message: 'payout card activated',
        data: existing,
      };
    }

    const card = await prisma.$transaction(async (tx) => {
      await tx.payoutCard.updateMany({
        where: { provider: existing.provider, active: true },
        data: { active: false },
      });

      return tx.payoutCard.update({ where: { id }, data: { active: true } });
    });

    await recordAudit({
      actorId,
      action: 'update',
      entity: 'payout_card',
      entityId: id,
      diff: { last4: { from: card.last4, to: card.last4 } },
    });

    return {
      success: true,
      _code: 'PAYOUT_CARD_ACTIVATED',
      _message: 'payout card activated',
      data: card,
    };
  }

  async remove(id: string, actorId: string | null) {
    const existing = await prisma.payoutCard.findUnique({ where: { id } });
    if (!existing) throw notFound('PAYOUT_CARD_NOT_FOUND', 'payout card not found');

    if (existing.active) {
      throw conflict('PAYOUT_CARD_ACTIVE_CANNOT_REMOVE', 'an active payout card cannot be removed');
    }

    await prisma.payoutCard.delete({ where: { id } });

    await recordAudit({
      actorId,
      action: 'delete',
      entity: 'payout_card',
      entityId: id,
      diff: { last4: { from: existing.last4, to: null } },
    });

    return { success: true, _code: 'PAYOUT_CARD_REMOVED', _message: 'payout card removed' };
  }
}
