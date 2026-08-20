import { Injectable } from '@tsed/di';
import { NotFound } from '@tsed/exceptions';
import { badRequest } from '@/utils/errors';
import {
  PAYMENT_PROVIDER,
  PAYMENT_STATUS,
  Prisma,
  SUBSCRIPTION_STATUS,
} from '../generated/prisma';
import prisma from '@/modules/db';
import events from '@/modules/events';

const FREE_PLAN = 'free';

@Injectable()
export class SubscriptionService {
  async current(userId: string) {
    const [subscription, payments] = await Promise.all([
      prisma.subscription.findFirst({
        where: { userId: userId, status: SUBSCRIPTION_STATUS.ACTIVE },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.payment.findMany({
        where: { userId: userId },
        orderBy: { createdAt: 'desc' },
        take: 20,
        select: {
          id: true,
          provider: true,
          amount: true,
          currency: true,
          status: true,
          paidAt: true,
          createdAt: true,
        },
      }),
    ]);

    return { success: true, data: { subscription, payments } };
  }

  async createPending(
    userId: string,
    planCode: string,
    provider: PAYMENT_PROVIDER,
    months: number,
  ) {
    if (planCode === FREE_PLAN) {
      throw badRequest('SUBSCRIPTION_FREE_NO_PAYMENT', 'the free plan needs no payment');
    }

    const plan = await prisma.plan.findUnique({ where: { code: planCode } });
    if (!plan || !plan.active) throw new NotFound(`plan not found: ${planCode}`);

    await prisma.subscription.updateMany({
      where: { userId: userId, status: SUBSCRIPTION_STATUS.PENDING },
      data: { status: SUBSCRIPTION_STATUS.CANCELED },
    });

    const subscription = await prisma.subscription.create({
      data: {
        userId: userId,
        planId: plan.id,
        status: SUBSCRIPTION_STATUS.PENDING,
        provider,
        autoRenew: false,
      },
      include: { plan: true },
    });

    return { subscription, plan, amount: Number(plan.priceUzs) * months, months };
  }

  async activate(subscriptionId: string, months: number) {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription) throw new NotFound('subscription not found');
    if (subscription.status === SUBSCRIPTION_STATUS.ACTIVE) {
      return subscription;
    }

    const now = new Date();

    const existing = await prisma.subscription.findFirst({
      where: {
        userId: subscription.userId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        periodEnd: { gt: now },
      },
      orderBy: { periodEnd: 'desc' },
    });

    const start = existing?.periodEnd ?? now;
    const end = new Date(start);
    end.setMonth(end.getMonth() + months);

    const [activated] = await prisma.$transaction([
      prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SUBSCRIPTION_STATUS.ACTIVE,
          periodStart: start,
          periodEnd: end,
        },
        include: { plan: true },
      }),
      ...(existing
        ? [
            prisma.subscription.update({
              where: { id: existing.id },
              data: { status: SUBSCRIPTION_STATUS.EXPIRED },
            }),
          ]
        : []),
    ]);

    events.emit('subscription.activated', {
      subscriptionId: activated.id,
      userId: activated.userId,
      planCode: activated.plan.code,
    });

    return activated;
  }

  async cancel(userId: string, subscriptionId: string) {
    const subscription = await prisma.subscription.findUnique({ where: { id: subscriptionId } });

    if (!subscription || subscription.userId !== userId) {
      throw new NotFound('subscription not found');
    }

    const updated = await prisma.subscription.update({
      where: { id: subscriptionId },
      data: { autoRenew: false },
    });

    return {
      success: true,
      _code: 'SUBSCRIPTION_UPDATED',
      _message: `subscription runs until ${updated.periodEnd?.toISOString().slice(0, 10) ?? 'the end of the period'}`,
      meta: { until: updated.periodEnd?.toISOString().slice(0, 10) ?? '' },
      data: updated,
    };
  }

  async recordPayment(input: {
    userId: string;
    subscriptionId: string | null;
    provider: PAYMENT_PROVIDER;
    externalId: string;
    amount: number;
    status: PAYMENT_STATUS;
    raw?: unknown;
  }) {
    return prisma.payment.upsert({
      where: {
        provider_externalId: { provider: input.provider, externalId: input.externalId },
      },
      update: {
        status: input.status,
        ...(input.status === PAYMENT_STATUS.PAID ? { paidAt: new Date() } : {}),
        raw: (input.raw ?? undefined) as Prisma.InputJsonValue,
      },
      create: {
        userId: input.userId,
        subscriptionId: input.subscriptionId,
        provider: input.provider,
        externalId: input.externalId,
        amount: input.amount,
        status: input.status,
        ...(input.status === PAYMENT_STATUS.PAID ? { paidAt: new Date() } : {}),
        raw: (input.raw ?? undefined) as Prisma.InputJsonValue,
      },
    });
  }

  async findPayment(provider: PAYMENT_PROVIDER, externalId: string) {
    return prisma.payment.findUnique({
      where: { provider_externalId: { provider, externalId: externalId } },
      include: { subscription: { include: { plan: true } } },
    });
  }

  async findPendingSubscription(id: string) {
    return prisma.subscription.findUnique({ where: { id }, include: { plan: true, user: true } });
  }
}
