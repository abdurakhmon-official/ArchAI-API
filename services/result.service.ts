import prisma from '@/modules/db';
import { PlatformContext } from '@tsed/common';
import { Injectable, InjectContext } from '@tsed/di';
import { Request } from 'express';
import { Forbidden, NotFound } from '@tsed/exceptions';
import { Prisma } from '@/generated/prisma';
import { BasicSearch, BasicSearchSchema } from '@/inputs';

@Injectable()
export class ResultService {
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
    const where: Prisma.TestAttemptsWhereInput = this.user?.isAdmin ? {} : { user_id: this.user?.id };

    const [attempts, count] = await prisma.$transaction([
      prisma.testAttempts.findMany({
        where,
        take: search.size,
        skip: search.skip,
        select: {
          id: true,
          total_questions: true,
          correct_count: true,
          incorrect_count: true,
          score: true,
          percent: true,
          duration_seconds: true,
          created_at: true,
          test: { select: { id: true, name: true, subject: true } },
        },
        orderBy: [search.sorting, { id: 'asc' }] as Prisma.TestAttemptsOrderByWithRelationInput[],
      }),
      prisma.testAttempts.count({ where }),
    ]);

    return { success: true, data: { items: attempts, count } };
  }

  async get(id: string) {
    const attempt = await prisma.testAttempts.findUnique({
      where: { id },
      include: {
        test: { select: { id: true, name: true, subject: true } },
        answers: {
          orderBy: { question: { order: 'asc' } },
          select: {
            id: true,
            selected_option: true,
            is_correct: true,
            question: {
              select: {
                id: true,
                text: true,
                option_a: true,
                option_b: true,
                option_c: true,
                option_d: true,
                correct_option: true,
                order: true,
              },
            },
          },
        },
      },
    });

    if (!attempt) {
      throw new NotFound('result not found');
    }

    if (attempt.user_id !== this.user?.id && !this.user?.isAdmin) {
      throw new Forbidden('you are not allowed to view this result');
    }

    return { success: true, data: attempt };
  }
}
