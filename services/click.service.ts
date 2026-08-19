import type { ClickResponse } from '@/types/click.types';
import { createHash } from 'node:crypto';
import { Inject, Injectable } from '@tsed/di';
import { PAYMENT_PROVIDER, PAYMENT_STATUS, SUBSCRIPTION_STATUS } from '../generated/prisma';
import config from '@/config';
import type { ClickRequest } from '@/inputs/billing.input';
import { SubscriptionService } from '@/services/subscription.service';

export const CLICK_ERROR = {
  OK: 0,
  SIGN_CHECK_FAILED: -1,
  INCORRECT_AMOUNT: -2,
  ACTION_NOT_FOUND: -3,
  ALREADY_PAID: -4,
  USER_NOT_FOUND: -5,
  TRANSACTION_NOT_FOUND: -6,
  FAILED_TO_UPDATE: -7,
  ERROR_IN_REQUEST: -8,
  TRANSACTION_CANCELLED: -9,
} as const;

@Injectable()
export class ClickService {
  @Inject()
  private subscriptions!: SubscriptionService;

  async handle(request: ClickRequest): Promise<ClickResponse> {
    const base = {
      click_trans_id: request.click_trans_id,
      merchant_trans_id: request.merchant_trans_id,
    };

    if (!this.verifySignature(request)) {
      return { ...base, error: CLICK_ERROR.SIGN_CHECK_FAILED, error_note: 'Signature check failed' };
    }

    if (request.error && request.error < 0) {
      await this.markCancelled(request);
      return { ...base, error: CLICK_ERROR.TRANSACTION_CANCELLED, error_note: 'Transaction cancelled' };
    }

    switch (request.action) {
      case 0:
        return this.prepare(request, base);
      case 1:
        return this.complete(request, base);
      default:
        return { ...base, error: CLICK_ERROR.ACTION_NOT_FOUND, error_note: 'Action not found' };
    }
  }

  private async prepare(
    request: ClickRequest,
    base: Pick<ClickResponse, 'click_trans_id' | 'merchant_trans_id'>,
  ): Promise<ClickResponse> {
    const subscription = await this.subscriptions.findPendingSubscription(
      request.merchant_trans_id,
    );

    if (!subscription) {
      return { ...base, error: CLICK_ERROR.USER_NOT_FOUND, error_note: 'subscription not found' };
    }

    if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
      return { ...base, error: CLICK_ERROR.ALREADY_PAID, error_note: 'subscription is already active' };
    }

    const expected = Number(subscription.plan.price_uzs);
    if (Math.abs(request.amount - expected) > 0.01) {
      return { ...base, error: CLICK_ERROR.INCORRECT_AMOUNT, error_note: 'Noto\'g\'ri summa' };
    }

    await this.subscriptions.recordPayment({
      userId: subscription.user_id,
      subscriptionId: subscription.id,
      provider: PAYMENT_PROVIDER.CLICK,
      externalId: request.click_trans_id,
      amount: request.amount,
      status: PAYMENT_STATUS.PENDING,
      raw: { ...request, stage: 'prepared' },
    });

    return {
      ...base,
      merchant_prepare_id: request.click_trans_id,
      error: CLICK_ERROR.OK,
      error_note: 'Success',
    };
  }

  private async complete(
    request: ClickRequest,
    base: Pick<ClickResponse, 'click_trans_id' | 'merchant_trans_id'>,
  ): Promise<ClickResponse> {
    const payment = await this.subscriptions.findPayment(
      PAYMENT_PROVIDER.CLICK,
      request.click_trans_id,
    );

    if (!payment) {
      return {
        ...base,
        error: CLICK_ERROR.TRANSACTION_NOT_FOUND,
        error_note: 'transaction not found',
      };
    }

    if (payment.status === PAYMENT_STATUS.PAID) {
      return {
        ...base,
        merchant_confirm_id: payment.id,
        error: CLICK_ERROR.OK,
        error_note: 'Success',
      };
    }

    if (payment.status === PAYMENT_STATUS.CANCELED) {
      return {
        ...base,
        error: CLICK_ERROR.TRANSACTION_CANCELLED,
        error_note: 'transaction was cancelled',
      };
    }

    if (payment.subscription_id) {
      await this.subscriptions.activate(payment.subscription_id, 1);
    }

    const updated = await this.subscriptions.recordPayment({
      userId: payment.user_id,
      subscriptionId: payment.subscription_id,
      provider: PAYMENT_PROVIDER.CLICK,
      externalId: request.click_trans_id,
      amount: Number(payment.amount),
      status: PAYMENT_STATUS.PAID,
      raw: { ...request, stage: 'completed' },
    });

    return {
      ...base,
      merchant_confirm_id: updated.id,
      error: CLICK_ERROR.OK,
      error_note: 'Success',
    };
  }

  private async markCancelled(request: ClickRequest): Promise<void> {
    const payment = await this.subscriptions.findPayment(
      PAYMENT_PROVIDER.CLICK,
      request.click_trans_id,
    );

    if (!payment) return;

    await this.subscriptions.recordPayment({
      userId: payment.user_id,
      subscriptionId: payment.subscription_id,
      provider: PAYMENT_PROVIDER.CLICK,
      externalId: request.click_trans_id,
      amount: Number(payment.amount),
      status: PAYMENT_STATUS.CANCELED,
      raw: { ...request, stage: 'cancelled' },
    });
  }

  private verifySignature(request: ClickRequest): boolean {
    const key = config.payments.click.secretKey;
    if (!key) return false;

    const parts = [
      request.click_trans_id,
      request.service_id,
      key,
      request.merchant_trans_id,
      ...(request.action === 1 ? [request.merchant_prepare_id ?? ''] : []),
      String(request.amount),
      String(request.action),
      request.sign_time,
    ];

    const expected = createHash('md5').update(parts.join('')).digest('hex');

    return timingSafeEqual(expected, request.sign_string.toLowerCase());
  }

  buildCheckoutUrl(subscriptionId: string, amount: number): string {
    const params = new URLSearchParams({
      service_id: config.payments.click.serviceId,
      merchant_id: config.payments.click.merchantId,
      amount: String(amount),
      transaction_param: subscriptionId,
      return_url: `${config.webUrl}/kabinet/obuna`,
    });

    return `https://my.click.uz/services/pay?${params.toString()}`;
  }
}

function timingSafeEqual(first: string, second: string): boolean {
  if (first.length !== second.length) return false;

  let diff = 0;
  for (let index = 0; index < first.length; index++) {
    diff |= first.charCodeAt(index) ^ second.charCodeAt(index);
  }

  return diff === 0;
}
