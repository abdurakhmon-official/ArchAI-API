import prisma from '@/modules/db';
import { PlatformContext } from '@tsed/common';
import { BadRequest, NotFound } from '@tsed/exceptions';
import { Injectable, InjectContext } from '@tsed/di';
import { Request } from 'express';
import { hashPassword } from '@/modules/auth';
import { USER_PUBLIC_SELECT } from '@/utils/constants';
import { CreateUserInput, CreateUserInputSchema, UpdateUserRoleInput, UpdateUserRoleInputSchema } from '@/inputs/user.input';
import { BasicSearch, BasicSearchSchema } from '@/inputs';
import { Prisma } from '@/generated/prisma';

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

    const [items, count] = await prisma.$transaction([
      prisma.user.findMany({
        where,
        take: search.size,
        skip: search.skip,
        select: USER_PUBLIC_SELECT,
        orderBy: [search.sorting, { id: 'asc' }] as Prisma.UserOrderByWithRelationInput[],
      }),
      prisma.user.count({ where }),
    ]);

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
        subject: data.subject,
        school_name: data.school_name,
        region: data.region,
        district: data.district,
        phone: data.phone,
      },
      select: USER_PUBLIC_SELECT,
    });

    return { success: true, _message: 'user created', data: user };
  }

  async updateRole(id: string, input: UpdateUserRoleInput) {
    const data = UpdateUserRoleInputSchema.parse(input);

    const user = await prisma.user.findUnique({ where: { id } });
    if (!user) {
      throw new NotFound('user not found');
    }

    const updated = await prisma.user.update({
      where: { id },
      data: { role: data.role, ...(data.subject !== undefined ? { subject: data.subject } : {}) },
      select: USER_PUBLIC_SELECT,
    });

    return { success: true, _message: 'role updated', data: updated };
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

    return { success: true, _message: 'deleted' };
  }
}
