import type { PaymeTransactionState } from '@/types/payme.types';
import { Inject, Injectable } from '@tsed/di';
import { PAYMENT_PROVIDER, PAYMENT_STATUS, SUBSCRIPTION_STATUS } from '../generated/prisma';
import config from '@/config';
import prisma from '@/modules/db';
import { SubscriptionService } from '@/services/subscription.service';

/**
 * Payme Merchant API.
 *
 * Diqqat: bu yerda biz mijoz emas, SERVERMIZ. Payme bizning endpointimizga
 * JSON-RPC so'rov yuboradi va biz javob beramiz. Shuning uchun xato
 * kodlari ham ularning spetsifikatsiyasi bo'yicha aniq bo'lishi shart —
 * noto'g'ri kod integratsiyani rad ettiradi.
 *
 * Summa tiyinlarda keladi: 1 so'm = 100 tiyin.
 */

const TIYIN = 100;

/** Payme tranzaksiya holatlari. */
const STATE = {
  CREATED: 1,
  PERFORMED: 2,
  CANCELED: -1,
  CANCELED_AFTER_PERFORM: -2,
} as const;

/** Spetsifikatsiyadagi xato kodlari — o'zgartirib bo'lmaydi. */
export const PAYME_ERROR = {
  TRANSPORT: -32300,
  ACCESS_DENIED: -32504,
  METHOD_NOT_FOUND: -32601,
  INVALID_AMOUNT: -31001,
  TRANSACTION_NOT_FOUND: -31003,
  CANNOT_PERFORM: -31008,
  CANNOT_CANCEL: -31007,
  ACCOUNT_NOT_FOUND: -31050,
} as const;

export class PaymeError extends Error {
  constructor(
    readonly code: number,
    message: string,
    readonly data?: string,
  ) {
    super(message);
  }
}

@Injectable()
export class PaymeService {
  @Inject()
  private subscriptions!: SubscriptionService;

  /**
   * Basic auth tekshiruvi.
   *
   * Payme `Paycom:<kalit>` ni base64 qilib yuboradi. Kalit noto'g'ri bo'lsa
   * hech qanday tafsilot bermaymiz — bu ochiq endpoint.
   */
  authorize(header?: string): void {
    if (!config.payments.payme.secretKey) {
      throw new PaymeError(PAYME_ERROR.ACCESS_DENIED, 'Payme is not configured');
    }

    const token = (header ?? '').replace(/^Basic\s+/i, '');
    const decoded = Buffer.from(token, 'base64').toString('utf8');
    const [login, key] = decoded.split(':');

    if (login !== 'Paycom' || key !== config.payments.payme.secretKey) {
      throw new PaymeError(PAYME_ERROR.ACCESS_DENIED, 'Insufficient privilege');
    }
  }

  async handle(method: string, params: Record<string, unknown>): Promise<unknown> {
    switch (method) {
      case 'CheckPerformTransaction':
        return this.checkPerform(params);
      case 'CreateTransaction':
        return this.create(params);
      case 'PerformTransaction':
        return this.perform(params);
      case 'CancelTransaction':
        return this.cancel(params);
      case 'CheckTransaction':
        return this.check(params);
      case 'GetStatement':
        return this.statement(params);
      default:
        throw new PaymeError(PAYME_ERROR.METHOD_NOT_FOUND, 'Method not found');
    }
  }

  // -------------------------------------------------------------------------

  private async checkPerform(params: Record<string, unknown>) {
    const { subscription, amount } = await this.resolve(params);

    return {
      allow: true,
      detail: {
        receipt_type: 0,
        items: [
          {
            title: `ArchAI — ${subscription.plan.code} tarifi`,
            price: amount,
            count: 1,
            code: '10306001001000000',
            vat_percent: 0,
            package_code: '1',
          },
        ],
      },
    };
  }

  private async create(params: Record<string, unknown>) {
    const externalId = String(params.id ?? '');
    const existing = await this.subscriptions.findPayment(PAYMENT_PROVIDER.PAYME, externalId);

    if (existing) {
      const state = existing.raw as unknown as PaymeTransactionState;

      if (state.state !== STATE.CREATED) {
        throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'Transaction is not in created state');
      }

      return {
        create_time: state.create_time,
        transaction: existing.id,
        state: state.state,
      };
    }

    const { subscription, amount, months } = await this.resolve(params);
    const createTime = Number(params.time) || Date.now();

    const state: PaymeTransactionState = {
      state: STATE.CREATED,
      create_time: createTime,
      perform_time: 0,
      cancel_time: 0,
      reason: null,
      subscription_id: subscription.id,
      months,
    };

    const payment = await this.subscriptions.recordPayment({
      userId: subscription.user_id,
      subscriptionId: subscription.id,
      provider: PAYMENT_PROVIDER.PAYME,
      externalId,
      amount: amount / TIYIN,
      status: PAYMENT_STATUS.PENDING,
      raw: state,
    });

    return { create_time: createTime, transaction: payment.id, state: STATE.CREATED };
  }

  private async perform(params: Record<string, unknown>) {
    const externalId = String(params.id ?? '');
    const payment = await this.subscriptions.findPayment(PAYMENT_PROVIDER.PAYME, externalId);

    if (!payment) throw new PaymeError(PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Transaction not found');

    const state = payment.raw as unknown as PaymeTransactionState;

    // Takroriy so'rov — o'sha javobni qaytaramiz, ikkinchi marta
    // faollashtirmaymiz. Payme buni muntazam qiladi.
    if (state.state === STATE.PERFORMED) {
      return {
        transaction: payment.id,
        perform_time: state.perform_time,
        state: STATE.PERFORMED,
      };
    }

    if (state.state !== STATE.CREATED) {
      throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'Transaction is cancelled');
    }

    const performTime = Date.now();

    await this.subscriptions.activate(state.subscription_id, state.months);
    await this.subscriptions.recordPayment({
      userId: payment.user_id,
      subscriptionId: payment.subscription_id,
      provider: PAYMENT_PROVIDER.PAYME,
      externalId,
      amount: Number(payment.amount),
      status: PAYMENT_STATUS.PAID,
      raw: { ...state, state: STATE.PERFORMED, perform_time: performTime },
    });

    return { transaction: payment.id, perform_time: performTime, state: STATE.PERFORMED };
  }

  private async cancel(params: Record<string, unknown>) {
    const externalId = String(params.id ?? '');
    const payment = await this.subscriptions.findPayment(PAYMENT_PROVIDER.PAYME, externalId);

    if (!payment) throw new PaymeError(PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Transaction not found');

    const state = payment.raw as unknown as PaymeTransactionState;

    if (state.state === STATE.CANCELED || state.state === STATE.CANCELED_AFTER_PERFORM) {
      return { transaction: payment.id, cancel_time: state.cancel_time, state: state.state };
    }

    const cancelTime = Date.now();
    const nextState =
      state.state === STATE.PERFORMED ? STATE.CANCELED_AFTER_PERFORM : STATE.CANCELED;

    // To'lov amalga oshgandan keyin bekor qilinsa, obuna ham to'xtatiladi.
    if (state.state === STATE.PERFORMED && payment.subscription_id) {
      await prisma.subscription.update({
        where: { id: payment.subscription_id },
        data: { status: SUBSCRIPTION_STATUS.CANCELED },
      });
    }

    await this.subscriptions.recordPayment({
      userId: payment.user_id,
      subscriptionId: payment.subscription_id,
      provider: PAYMENT_PROVIDER.PAYME,
      externalId,
      amount: Number(payment.amount),
      status: PAYMENT_STATUS.CANCELED,
      raw: {
        ...state,
        state: nextState,
        cancel_time: cancelTime,
        reason: Number(params.reason) || null,
      },
    });

    return { transaction: payment.id, cancel_time: cancelTime, state: nextState };
  }

  private async check(params: Record<string, unknown>) {
    const externalId = String(params.id ?? '');
    const payment = await this.subscriptions.findPayment(PAYMENT_PROVIDER.PAYME, externalId);

    if (!payment) throw new PaymeError(PAYME_ERROR.TRANSACTION_NOT_FOUND, 'Transaction not found');

    const state = payment.raw as unknown as PaymeTransactionState;

    return {
      create_time: state.create_time,
      perform_time: state.perform_time,
      cancel_time: state.cancel_time,
      transaction: payment.id,
      state: state.state,
      reason: state.reason,
    };
  }

  private async statement(params: Record<string, unknown>) {
    const from = new Date(Number(params.from) || 0);
    const to = new Date(Number(params.to) || Date.now());

    const payments = await prisma.payment.findMany({
      where: { provider: PAYMENT_PROVIDER.PAYME, created_at: { gte: from, lte: to } },
      orderBy: { created_at: 'asc' },
    });

    return {
      transactions: payments.map((payment) => {
        const state = payment.raw as unknown as PaymeTransactionState;

        return {
          id: payment.external_id,
          time: state.create_time,
          amount: Number(payment.amount) * TIYIN,
          account: { subscription_id: state.subscription_id },
          create_time: state.create_time,
          perform_time: state.perform_time,
          cancel_time: state.cancel_time,
          transaction: payment.id,
          state: state.state,
          reason: state.reason,
        };
      }),
    };
  }

  /**
   * `account` ichidagi obuna identifikatorini tekshirish va summani solishtirish.
   *
   * Payme summani tiyinlarda yuboradi; farq bo'lsa tranzaksiyani rad etamiz —
   * aks holda foydalanuvchi kam to'lab obuna olib qo'yishi mumkin bo'lardi.
   */
  private async resolve(params: Record<string, unknown>) {
    const account = (params.account ?? {}) as Record<string, string>;
    const subscriptionId = account.subscription_id ?? account.order_id ?? '';

    if (!subscriptionId) {
      throw new PaymeError(
        PAYME_ERROR.ACCOUNT_NOT_FOUND,
        'subscription not found',
        'subscription_id',
      );
    }

    const subscription = await this.subscriptions.findPendingSubscription(subscriptionId);

    if (!subscription) {
      throw new PaymeError(PAYME_ERROR.ACCOUNT_NOT_FOUND, 'subscription not found', 'subscription_id');
    }

    if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
      throw new PaymeError(PAYME_ERROR.CANNOT_PERFORM, 'subscription is already active');
    }

    const months = 1;
    const expected = Number(subscription.plan.price_uzs) * months * TIYIN;
    const amount = Number(params.amount);

    if (amount !== expected) {
      throw new PaymeError(PAYME_ERROR.INVALID_AMOUNT, 'invalid amount');
    }

    return { subscription, amount, months };
  }
}
