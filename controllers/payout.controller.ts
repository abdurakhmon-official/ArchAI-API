import { timingSafeEqual } from 'node:crypto';
import { Req } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { BodyParams, HeaderParams, PathParams } from '@tsed/platform-params';
import { Delete, Get, Post, Put } from '@tsed/schema';
import type { Request } from 'express';
import { AdminOnly, Authorized } from '@/middlewares/auth.middleware';
import { forbidden } from '@/utils/errors';
import config from '@/config';
import { PayoutCardService } from '@/services/payout-card.service';
import type { PayoutCardInput } from '@/types/payout.types';

/**
 * PayoutCard uchlari — obuna to'lovi qaysi hisobga tushishini boshqaradi.
 *
 * O'qish oddiy `AdminOnly` bilan qo'riqlanadi. Yozish (qo'shish, tahrir,
 * faollashtirish, o'chirish) qo'shimcha `X-Billing-Secret` sarlavhasini
 * talab qiladi: baza yoki admin hisobi o'g'irlansa ham, kim to'lov
 * ketadigan hisobni almashtira olmasin.
 */
@Controller('/payout-cards')
export class PayoutController {
  @Inject()
  private payoutCards!: PayoutCardService;

  @Get('')
  @Authorized(AdminOnly())
  async list() {
    return this.payoutCards.list();
  }

  @Post('')
  @Authorized(AdminOnly())
  async create(
    @Req() request: Request,
    @HeaderParams('x-billing-secret') secret: string,
    @BodyParams() body: PayoutCardInput,
  ) {
    this.assertSecret(secret);
    return this.payoutCards.create(body, request.user!.id);
  }

  @Put('/:id')
  @Authorized(AdminOnly())
  async update(
    @Req() request: Request,
    @HeaderParams('x-billing-secret') secret: string,
    @PathParams('id') id: string,
    @BodyParams() body: Partial<PayoutCardInput>,
  ) {
    this.assertSecret(secret);
    return this.payoutCards.update(id, body, request.user!.id);
  }

  @Post('/:id/activate')
  @Authorized(AdminOnly())
  async activate(
    @Req() request: Request,
    @HeaderParams('x-billing-secret') secret: string,
    @PathParams('id') id: string,
  ) {
    this.assertSecret(secret);
    return this.payoutCards.activate(id, request.user!.id);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  async remove(
    @Req() request: Request,
    @HeaderParams('x-billing-secret') secret: string,
    @PathParams('id') id: string,
  ) {
    this.assertSecret(secret);
    return this.payoutCards.remove(id, request.user!.id);
  }

  /**
   * `crypto.timingSafeEqual` ishlatiladi — oddiy `===` javob vaqtidan
   * kalitni bilib olishga imkon beradi (timing attack).
   */
  private assertSecret(provided?: string): void {
    const expected = config.billingSecret ?? '';
    const expectedBuf = Buffer.from(expected);
    const providedBuf = Buffer.from(provided ?? '');

    const matches =
      expected.length > 0 &&
      expectedBuf.length === providedBuf.length &&
      timingSafeEqual(expectedBuf, providedBuf);

    if (!matches) {
      throw forbidden('BILLING_SECRET_INVALID', 'billing secret is missing or invalid');
    }
  }
}
