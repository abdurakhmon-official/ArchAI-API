import prisma from '@/modules/db';
import { PlatformContext } from '@tsed/common';
import { Injectable, InjectContext } from '@tsed/di';
import { Request } from 'express';
import { USER_ROLE } from '@/generated/prisma';

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
    const subject = this.user?.role === USER_ROLE.TEACHER ? this.user?.subject : null;

    const [totalTests, myAttempts, bestAttempt, recentAttempts] = await prisma.$transaction([
      prisma.tests.count({ where: { active: true, ...(subject ? { subject } : {}) } }),
      prisma.testAttempts.findMany({ where: { user_id: userId }, select: { percent: true } }),
      prisma.testAttempts.findFirst({
        where: { user_id: userId },
        orderBy: { percent: 'desc' },
        select: { percent: true },
      }),
      prisma.testAttempts.findMany({
        where: { user_id: userId },
        take: 5,
        orderBy: { created_at: 'desc' },
        select: {
          id: true,
          percent: true,
          score: true,
          total_questions: true,
          created_at: true,
          test: { select: { id: true, name: true, subject: true } },
        },
      }),
    ]);

    const completedTests = myAttempts.length;
    const averageScore = completedTests
      ? Math.round((myAttempts.reduce((sum, attempt) => sum + attempt.percent, 0) / completedTests) * 100) / 100
      : 0;

    return {
      success: true,
      data: {
        totalTests,
        completedTests,
        averageScore,
        bestScore: bestAttempt?.percent ?? 0,
        recentAttempts,
      },
    };
  }
}
