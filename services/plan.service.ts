import type { PlanLimits, EffectivePlan } from '@/types/plan.types';
import { Injectable } from '@tsed/di';
import { badRequest, notFound } from '@/utils/errors';
import { Prisma, SUBSCRIPTION_STATUS } from '../generated/prisma';
import prisma from '@/modules/db';
import { PlanInputSchema, type PlanInput } from '@/inputs/billing.input';
import { diffOf, recordAudit } from '@/utils/audit';

const FREE_FALLBACK: PlanLimits = {
  projects: 1,
  variants: 1,
  versions: 0,
  pdf: false,
  dwg: false,
  interior: false,
  edit: false,
  watermark: true,
};

@Injectable()
export class PlanService {
  async list() {
    const plans = await prisma.plan.findMany({
      where: { active: true },
      orderBy: { sort: 'asc' },
    });

    return { success: true, data: plans };
  }

  async byCode(code: string) {
    const plan = await prisma.plan.findUnique({ where: { code } });
    if (!plan) throw notFound('PLAN_NOT_FOUND', `plan not found: ${code}`);

    return { success: true, data: plan };
  }

  async listAll() {
    const plans = await prisma.plan.findMany({
      orderBy: { sort: 'asc' },
      include: { _count: { select: { subscriptions: true } } },
    });

    return { success: true, data: plans };
  }

  async create(input: PlanInput, actorId: string | null = null) {
    const data = PlanInputSchema.parse(input);

    const clash = await prisma.plan.findUnique({ where: { code: data.code } });
    if (clash) throw badRequest('CODE_TAKEN', 'this code is already taken');

    const plan = await prisma.plan.create({ data: this.toPrisma(data) as never });
    await recordAudit({ actorId, action: 'create', entity: 'plan', entityId: plan.id });

    return { success: true, _code: 'PLAN_CREATED', _message: 'plan created', data: plan };
  }

  async update(id: string, input: Partial<PlanInput>, actorId: string | null = null) {
    const data = PlanInputSchema.partial().parse(input);

    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) throw notFound('PLAN_NOT_FOUND', 'plan not found');

    if (data.code && data.code !== existing.code) {
      const clash = await prisma.plan.findUnique({ where: { code: data.code } });
      if (clash && clash.id !== id) throw badRequest('CODE_TAKEN', 'this code is already taken');
    }

    const plan = await prisma.plan.update({ where: { id }, data: this.toPrisma(data) as never });
    await recordAudit({
      actorId,
      action: 'update',
      entity: 'plan',
      entityId: id,
      diff: diffOf(existing, plan),
    });

    return { success: true, _code: 'PLAN_UPDATED', _message: 'plan updated', data: plan };
  }

  async deactivate(id: string, actorId: string | null = null) {
    const existing = await prisma.plan.findUnique({ where: { id } });
    if (!existing) throw notFound('PLAN_NOT_FOUND', 'plan not found');

    const plan = await prisma.plan.update({ where: { id }, data: { active: false } });
    await recordAudit({ actorId, action: 'deactivate', entity: 'plan', entityId: id });

    return { success: true, _code: 'PLAN_DEACTIVATED', _message: 'plan deactivated', data: plan };
  }

  async subscriptions(page = 1, limit = 30) {
    const take = Math.min(Math.max(limit, 1), 100);
    const skip = (Math.max(page, 1) - 1) * take;

    const [items, total] = await prisma.$transaction([
      prisma.subscription.findMany({
        orderBy: { created_at: 'desc' },
        skip,
        take,
        include: {
          plan: { select: { code: true, name: true } },
          user: { select: { id: true, fullName: true, email: true } },
          payments: {
            orderBy: { created_at: 'desc' },
            take: 1,
            select: { status: true, amount: true, currency: true, paid_at: true },
          },
        },
      }),
      prisma.subscription.count(),
    ]);

    return {
      success: true,
      data: items,
      meta: { page, limit: take, total, pages: Math.ceil(total / take) },
    };
  }

  async effectiveFor(userId: string): Promise<EffectivePlan> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        user_id: userId,
        status: SUBSCRIPTION_STATUS.ACTIVE,
        OR: [{ period_end: null }, { period_end: { gt: new Date() } }],
      },
      include: { plan: true },
      orderBy: { created_at: 'desc' },
    });

    if (subscription) {
      return {
        code: subscription.plan.code,
        limits: this.normalize(subscription.plan.limits),
        expiresAt: subscription.period_end,
      };
    }

    const free = await prisma.plan.findUnique({ where: { code: 'free' } });

    return {
      code: 'free',
      limits: free ? this.normalize(free.limits) : FREE_FALLBACK,
      expiresAt: null,
    };
  }

  async projectCount(userId: string): Promise<number> {
    return prisma.project.count({ where: { user_id: userId, deleted_at: null } });
  }

  private toPrisma(data: Partial<PlanInput>) {
    const { description, ...rest } = data;

    return {
      ...rest,
      ...(description === undefined ? {} : { description: description ?? Prisma.DbNull }),
    };
  }

  private normalize(raw: unknown): PlanLimits {
    const limits = (raw ?? {}) as Partial<PlanLimits>;

    return {
      projects: this.numberOr(limits.projects, FREE_FALLBACK.projects),
      variants: this.numberOr(limits.variants, FREE_FALLBACK.variants),
      versions: this.numberOr(limits.versions, FREE_FALLBACK.versions),
      pdf: Boolean(limits.pdf),
      dwg: limits.dwg === 'on_request' ? 'on_request' : Boolean(limits.dwg),
      interior: Boolean(limits.interior),
      edit: Boolean(limits.edit),
      watermark: limits.watermark !== false,
    };
  }

  private numberOr(value: unknown, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
  }
}
