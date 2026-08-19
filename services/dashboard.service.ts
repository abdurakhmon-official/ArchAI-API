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
      prisma.project.count({ where: { user_id: userId, deleted_at: null } }),
      prisma.subscription.findFirst({
        where: { user_id: userId, status: SUBSCRIPTION_STATUS.ACTIVE },
        include: { plan: true },
        orderBy: { created_at: 'desc' },
      }),
      prisma.project.findMany({
        where: { user_id: userId, deleted_at: null },
        take: RECENT_LIMIT,
        orderBy: { updated_at: 'desc' },
        select: {
          id: true,
          title: true,
          cover_svg: true,
          estimate_total: true,
          updated_at: true,
          style: { select: { slug: true, name: true } },
        },
      }),
    ]);

    return {
      success: true,
      data: {
        projectCount,
        plan: subscription?.plan.code ?? 'free',
        planExpiresAt: subscription?.period_end ?? null,
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
        prisma.user.count({ where: { created_at: { gte: monthAgo } } }),
        prisma.project.count({ where: { deleted_at: null } }),
        prisma.project.count({ where: { deleted_at: null, created_at: { gte: monthAgo } } }),
        prisma.subscription.count({ where: { status: SUBSCRIPTION_STATUS.ACTIVE } }),
        prisma.lead.count({ where: { status: 'NEW' } }),
        prisma.payment.aggregate({
          where: { status: PAYMENT_STATUS.PAID, paid_at: { gte: monthAgo } },
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
