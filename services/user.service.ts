import prisma from '@/modules/db';
import { PlatformContext } from '@tsed/common';
import { BadRequest, NotFound } from '@tsed/exceptions';
import { Injectable, InjectContext } from '@tsed/di';
import { Request } from 'express';
import { comparePassword, hashPassword } from '@/modules/auth';
import { USER_PUBLIC_SELECT } from '@/utils/constants';
import {
  AssignUserPlanInput,
  AssignUserPlanInputSchema,
  CreateUserInput,
  CreateUserInputSchema,
  UpdateUserRoleInput,
  UpdateUserRoleInputSchema,
} from '@/inputs/user.input';
import { BasicSearch, BasicSearchSchema } from '@/inputs';
import { badRequest } from '@/utils/errors';
import { diffOf, recordAudit } from '@/utils/audit';
import { Prisma, SUBSCRIPTION_STATUS } from '../generated/prisma';

const FREE_PLAN = 'free';

@Injectable()
export class UserService {
  @InjectContext()
  private context!: PlatformContext;

  get req() {
    return this.context.getRequest<Request>();
  }

  get user() {
    return this.req.user;
  }

  async pagination(query: BasicSearch) {
    const search = BasicSearchSchema.parse(query);
    const where: Prisma.UserWhereInput = {};

    if (search.search?.trim()) {
      const contains = { contains: search.search.trim(), mode: Prisma.QueryMode.insensitive };
      where.OR = [{ fullName: contains }, { email: contains }];
    }

    const [rows, count] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        take: search.size,
        skip: search.skip,
        select: {
          ...USER_PUBLIC_SELECT,
          subscriptions: {
            where: { status: SUBSCRIPTION_STATUS.ACTIVE },
            orderBy: { periodEnd: 'desc' },
            take: 1,
            select: { plan: { select: { code: true, name: true } } },
          },
        },
        orderBy: [search.sorting, { id: 'asc' }] as Prisma.UserOrderByWithRelationInput[],
      }),
      prisma.user.count({ where }),
    ]);

    const items = rows.map(({ subscriptions, ...user }) => ({
      ...user,
      currentPlan: subscriptions[0]?.plan ?? null,
    }));

    return { success: true, data: { items, count } };
  }

  async create(input: CreateUserInput) {
    const data = CreateUserInputSchema.parse(input);
    const email = data.email.toLowerCase();

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      throw new BadRequest('email already exist');
    }

    const user = await prisma.user.create({
      data: {
        fullName: data.fullName,
        email,
        password: await hashPassword(data.password),
        role: data.role,
        phone: data.phone,
        locale: data.locale,
      },
      select: USER_PUBLIC_SELECT,
    });

    return { success: true, _code: 'USER_CREATED', _message: 'user created', data: user };
  }

  async updateRole(id: string, input: UpdateUserRoleInput) {
    const data = UpdateUserRoleInputSchema.parse(input);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFound('user not found');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: data.role },
      select: USER_PUBLIC_SELECT,
    });

    return { success: true, _code: 'USER_ROLE_UPDATED', _message: 'role updated', data: updated };
  }

  /**
   * Admin tomonidan tarif berish — to'lovsiz, faqat adminning o'z
   * parolini qayta kiritishi orqali tasdiqlanadi (`request.user` da
   * parol yo'q, shuning uchun actor alohida qayta o'qiladi).
   */
  async assignPlan(id: string, input: AssignUserPlanInput, actorId: string) {
    const data = AssignUserPlanInputSchema.parse(input);

    const actor = await prisma.user.findUnique({ where: { id: actorId } });
    if (!actor) throw new NotFound('actor not found');

    const validPassword = await comparePassword(data.password, actor.password);
    if (!validPassword) {
      throw badRequest('AUTH_PASSWORD_INCORRECT', 'current password is incorrect');
    }

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFound('user not found');

    const plan = await prisma.plan.findUnique({ where: { code: data.planCode } });
    if (!plan || !plan.active) throw new NotFound(`plan not found: ${data.planCode}`);

    const existing = await prisma.subscription.findFirst({
      where: { userId: id, status: SUBSCRIPTION_STATUS.ACTIVE },
      include: { plan: true },
      orderBy: { periodEnd: 'desc' },
    });

    if (data.planCode === FREE_PLAN) {
      if (existing) {
        await prisma.subscription.update({
          where: { id: existing.id },
          data: { status: SUBSCRIPTION_STATUS.EXPIRED },
        });
      }
    } else {
      const now = new Date();
      const end = new Date(now);
      end.setMonth(end.getMonth() + 1);

      await prisma.$transaction([
        prisma.subscription.create({
          data: {
            userId: id,
            planId: plan.id,
            status: SUBSCRIPTION_STATUS.ACTIVE,
            periodStart: now,
            periodEnd: end,
            autoRenew: false,
          },
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
    }

    await recordAudit({
      actorId,
      action: 'update',
      entity: 'user_plan',
      entityId: id,
      diff: diffOf({ plan: existing?.plan.code ?? FREE_PLAN }, { plan: data.planCode }),
    });

    return { success: true, _code: 'USER_PLAN_ASSIGNED', _message: 'plan assigned', data: { planCode: data.planCode } };
  }

  async delete(id: string) {
    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFound('user not found');
    }

    if (id === this.user?.id) {
      throw new BadRequest("you can't delete your own account");
    }

    await prisma.user.delete({ where: { id } });

    return { success: true, _code: 'USER_DELETED', _message: 'deleted' };
  }
}
