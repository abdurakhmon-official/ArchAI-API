import { Req } from '@tsed/common';
import { Controller, Inject } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import { BodyParams, PathParams } from '@tsed/platform-params';
import { Delete, Get, Post, Summary } from '@tsed/schema';
import type { Request } from 'express';
import { PAYMENT_PROVIDER } from '../generated/prisma';
import { Authenticate, Authorized } from '@/middlewares/auth.middleware';
import { CheckoutInputSchema, type CheckoutInput } from '@/inputs/billing.input';
import { ClickService } from '@/services/click.service';
import { PlanService } from '@/services/plan.service';
import { StripeService } from '@/services/stripe.service';
import { SubscriptionService } from '@/services/subscription.service';
import config from '@/config';

@Controller('/billing')
export class BillingController {
  @Inject()
  private planService!: PlanService;

  @Inject()
  private subscriptions!: SubscriptionService;

  @Inject()
  private click!: ClickService;

  @Inject()
  private stripe!: StripeService;

  @Get('/plans')
  async plans() {
    return this.planService.list();
  }

  @Get('/subscription')
  @Authorized(Authenticate())
  async subscription(@Req() request: Request) {
    return this.subscriptions.current(request.user!.id);
  }

  @Post('/checkout')
  @Authorized(Authenticate())
  async checkout(@Req() request: Request, @BodyParams() body: CheckoutInput) {
    const input = CheckoutInputSchema.parse(body);
    const user = request.user!;

    this.assertProviderReady(input.provider);

    const { subscription, plan, amount, months } = await this.subscriptions.createPending(
      user.id,
      input.planCode,
      input.provider,
      input.months,
    );

    switch (input.provider) {
      case PAYMENT_PROVIDER.CLICK:
        return {
          success: true,
          data: {
            provider: input.provider,
            subscriptionId: subscription.id,
            amount,
            currency: 'UZS',
            redirectUrl: this.click.buildCheckoutUrl(subscription.id, amount),
          },
        };

      case PAYMENT_PROVIDER.PAYME: {
        const payload = Buffer.from(
          [
            `m=${config.payments.payme.merchantId}`,
            `ac.subscription_id=${subscription.id}`,
            `a=${amount * 100}`,
            `c=${config.webUrl}/kabinet/obuna`,
          ].join(';'),
        ).toString('base64');

        return {
          success: true,
          data: {
            provider: input.provider,
            subscriptionId: subscription.id,
            amount,
            currency: 'UZS',
            redirectUrl: `https://checkout.paycom.uz/${payload}`,
          },
        };
      }

      case PAYMENT_PROVIDER.STRIPE: {
        const session = await this.stripe.createCheckout({
          subscriptionId: subscription.id,
          userId: user.id,
          email: user.email,
          planName: plan.code,
          amountUsd: Number(plan.price_usd) * input.months,
          months,
          returnUrl: input.returnUrl,
        });

        return {
          success: true,
          data: {
            provider: input.provider,
            subscriptionId: subscription.id,
            amount: Number(plan.price_usd) * input.months,
            currency: 'USD',
            redirectUrl: session.url,
            sessionId: session.sessionId,
          },
        };
      }

      default:
        throw new BadRequest(`unsupported provider: ${input.provider}`);
    }
  }

  @Delete('/subscription/:id')
  @Authorized(Authenticate())
  async cancel(@Req() request: Request, @PathParams('id') id: string) {
    return this.subscriptions.cancel(request.user!.id, id);
  }

  @Get('/providers')
  async providers() {
    return {
      success: true,
      data: [
        { code: PAYMENT_PROVIDER.PAYME, ready: Boolean(config.payments.payme.merchantId), currency: 'UZS' },
        { code: PAYMENT_PROVIDER.CLICK, ready: Boolean(config.payments.click.serviceId), currency: 'UZS' },
        { code: PAYMENT_PROVIDER.STRIPE, ready: Boolean(config.payments.stripe.secretKey), currency: 'USD' },
      ],
    };
  }

  private assertProviderReady(provider: PAYMENT_PROVIDER): void {
    const ready: Record<PAYMENT_PROVIDER, boolean> = {
      [PAYMENT_PROVIDER.PAYME]: Boolean(config.payments.payme.merchantId),
      [PAYMENT_PROVIDER.CLICK]: Boolean(config.payments.click.serviceId),
      [PAYMENT_PROVIDER.STRIPE]: Boolean(config.payments.stripe.secretKey),
    };

    if (!ready[provider]) {
      throw new BadRequest(`${provider} to'lov tizimi hali sozlanmagan`);
    }
  }
}
