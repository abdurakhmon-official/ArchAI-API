import type { ClickResponse } from '@/types/click.types';
import { Inject, Injectable } from '@tsed/di';
import { PAYMENT_PROVIDER, PAYMENT_STATUS, SUBSCRIPTION_STATUS } from '../generated/prisma';
import config from '@/config';
import type { ClickRequest } from '@/inputs/billing.input';
import prisma from '@/modules/db';
import { SubscriptionService } from '@/services/subscription.service';
import { verifyClickSignature } from '@/utils/click-signature';

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

    const expected = Number(subscription.plan.priceUzs);
    if (Math.abs(request.amount - expected) > 0.01) {
      return { ...base, error: CLICK_ERROR.INCORRECT_AMOUNT, error_note: 'Noto\'g\'ri summa' };
    }

    await this.subscriptions.recordPayment({
      userId: subscription.userId,
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

    // REFUNDED is a cancellation that happened after payment (see
    // `markCancelled`) — just as terminal as CANCELED, it must not fall
    // through to being activated again below.
    if (payment.status === PAYMENT_STATUS.CANCELED || payment.status === PAYMENT_STATUS.REFUNDED) {
      return {
        ...base,
        error: CLICK_ERROR.TRANSACTION_CANCELLED,
        error_note: 'transaction was cancelled',
      };
    }

    if (payment.subscriptionId) {
      await this.subscriptions.activate(payment.subscriptionId, 1);
    }

    const updated = await this.subscriptions.recordPayment({
      userId: payment.userId,
      subscriptionId: payment.subscriptionId,
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

    // Cancelling a transaction that was already paid is a refund: the
    // money was charged and is being returned, and the subscription it
    // paid for stops instead of staying active for free.
    const wasPaid = payment.status === PAYMENT_STATUS.PAID;

    if (wasPaid && payment.subscriptionId) {
      await prisma.subscription.update({
        where: { id: payment.subscriptionId },
        data: { status: SUBSCRIPTION_STATUS.CANCELED },
      });
    }

    await this.subscriptions.recordPayment({
      userId: payment.userId,
      subscriptionId: payment.subscriptionId,
      provider: PAYMENT_PROVIDER.CLICK,
      externalId: request.click_trans_id,
      amount: Number(payment.amount),
      status: wasPaid ? PAYMENT_STATUS.REFUNDED : PAYMENT_STATUS.CANCELED,
      raw: { ...request, stage: 'cancelled' },
    });
  }

  private verifySignature(request: ClickRequest): boolean {
    return verifyClickSignature(
      {
        clickTransId: request.click_trans_id,
        serviceId: request.service_id,
        merchantTransId: request.merchant_trans_id,
        merchantPrepareId: request.merchant_prepare_id,
        amount: request.amount,
        action: request.action,
        signTime: request.sign_time,
      },
      config.payments.click.secretKey,
      request.sign_string,
    );
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
