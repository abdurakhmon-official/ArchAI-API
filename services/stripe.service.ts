import { Inject, Injectable } from '@tsed/di';
import { BadRequest } from '@tsed/exceptions';
import Stripe from 'stripe';
import config from '@/config';
import { PAYMENT_PROVIDER, PAYMENT_STATUS } from '../generated/prisma';
import { SubscriptionService } from '@/services/subscription.service';

@Injectable()
export class StripeService {
  @Inject()
  private subscriptions!: SubscriptionService;

  private client: Stripe | null = null;

  private stripe(): Stripe {
    if (!config.payments.stripe.secretKey) {
      throw new BadRequest('Stripe is not configured');
    }

    if (!this.client) {
      this.client = new Stripe(config.payments.stripe.secretKey);
    }

    return this.client;
  }

  async createCheckout(input: {
    subscriptionId: string;
    userId: string;
    email: string;
    planName: string;
    amountUsd: number;
    months: number;
    returnUrl?: string;
  }): Promise<{ url: string; sessionId: string }> {
    const successUrl = input.returnUrl ?? `${config.webUrl}/kabinet/obuna?status=success`;

    const session = await this.stripe().checkout.sessions.create({
      mode: 'payment',
      customer_email: input.email,
      client_reference_id: input.subscriptionId,
      metadata: {
        subscription_id: input.subscriptionId,
        user_id: input.userId,
        months: String(input.months),
      },
      line_items: [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: Math.round(input.amountUsd * 100),
            product_data: {
              name: `ArchAI — ${input.planName}`,
              description: `${input.months} oylik obuna`,
            },
          },
        },
      ],
      success_url: `${successUrl}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${config.webUrl}/narxlash?status=cancelled`,
    });

    if (!session.url) throw new BadRequest('Stripe sessiyasi yaratilmadi');

    return { url: session.url, sessionId: session.id };
  }

  async handleWebhook(rawBody: Buffer, signature?: string): Promise<{ received: true }> {
    const secret = config.payments.stripe.webhookSecret;

    if (!secret) throw new BadRequest('Stripe webhook secret is not configured');
    if (!signature) throw new BadRequest('missing stripe-signature header');

    let event: Stripe.Event;

    try {
      event = this.stripe().webhooks.constructEvent(rawBody, signature, secret);
    } catch (error) {
      throw new BadRequest(`webhook signature verification failed: ${(error as Error).message}`);
    }

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCompleted(event.data.object);
        break;

      case 'checkout.session.expired':
      case 'charge.refunded':
        await this.onFailed(event.data.object as Stripe.Checkout.Session);
        break;

      default:
        break;
    }

    return { received: true };
  }

  private async onCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const subscriptionId = session.client_reference_id ?? session.metadata?.subscription_id;
    if (!subscriptionId) return;

    const subscription = await this.subscriptions.findPendingSubscription(subscriptionId);
    if (!subscription) return;

    const months = Number(session.metadata?.months) || 1;

    await this.subscriptions.activate(subscriptionId, months);
    await this.subscriptions.recordPayment({
      userId: subscription.user_id,
      subscriptionId,
      provider: PAYMENT_PROVIDER.STRIPE,
      externalId: session.id,
      amount: (session.amount_total ?? 0) / 100,
      status: PAYMENT_STATUS.PAID,
      raw: session as unknown,
    });
  }

  private async onFailed(session: Stripe.Checkout.Session): Promise<void> {
    const subscriptionId = session.client_reference_id ?? session.metadata?.subscription_id;
    if (!subscriptionId) return;

    const subscription = await this.subscriptions.findPendingSubscription(subscriptionId);
    if (!subscription) return;

    await this.subscriptions.recordPayment({
      userId: subscription.user_id,
      subscriptionId,
      provider: PAYMENT_PROVIDER.STRIPE,
      externalId: session.id,
      amount: (session.amount_total ?? 0) / 100,
      status: PAYMENT_STATUS.FAILED,
      raw: session as unknown,
    });
  }
}
