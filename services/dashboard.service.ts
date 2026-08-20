import prisma from '@/modules/db';
import { PlatformContext } from '@tsed/common';
import { Injectable, InjectContext } from '@tsed/di';
import { Request } from 'express';
import { PAYMENT_STATUS, SUBSCRIPTION_STATUS } from '../generated/prisma';

const RECENT_LIMIT = 5;

@Injectable()
export class DashboardService {
  @InjectContext()
  private context!: PlatformContext;

  get req() {
    return this.context.getRequest<Request>();
  }

  get user() {
    return this.req.user;
  }

  async stats() {
    const userId = this.user!.id;

    const [projectCount, subscription, recentProjects] = await prisma.$transaction([
      prisma.project.count({ where: { userId: userId, deletedAt: null } }),
      prisma.subscription.findFirst({
        where: { userId: userId, status: SUBSCRIPTION_STATUS.ACTIVE },
        include: { plan: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.project.findMany({
        where: { userId: userId, deletedAt: null },
        take: RECENT_LIMIT,
        orderBy: { updatedAt: 'desc' },
        select: {
          id: true,
          title: true,
          coverSvg: true,
          estimateTotal: true,
          updatedAt: true,
          style: { select: { slug: true, name: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        projectCount,
        plan: subscription?.plan.code ?? 'free',
        planExpiresAt: subscription?.periodEnd ?? null,
        recentProjects,
      },
    };
  }

  async adminStats() {
    const monthAgo = new Date();
    monthAgo.setDate(monthAgo.getDate() - 30);

    const [users, newUsers, projects, newProjects, activeSubs, leads, revenue] =
      await prisma.$transaction([
        prisma.user.count(),
        prisma.user.count({ where: { createdAt: { gte: monthAgo } } }),
        prisma.project.count({ where: { deletedAt: null } }),
        prisma.project.count({ where: { deletedAt: null, createdAt: { gte: monthAgo } } }),
        prisma.subscription.count({ where: { status: SUBSCRIPTION_STATUS.ACTIVE } }),
        prisma.lead.count({ where: { status: 'NEW' } }),
        prisma.payment.aggregate({
          where: { status: PAYMENT_STATUS.PAID, paidAt: { gte: monthAgo } },
          _sum: { amount: true },
        }),
      ]);

    return {
      success: true,
      data: {
        users,
        newUsers,
        projects,
        newProjects,
        activeSubscriptions: activeSubs,
        openLeads: leads,
        revenue30d: revenue._sum.amount ?? 0,
      },
    };
  }
}
