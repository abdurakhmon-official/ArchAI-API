import prisma from '@/modules/db';
import { PlatformContext } from '@tsed/common';
import { Injectable, InjectContext } from '@tsed/di';
import { Request } from 'express';
import { BadRequest, NotFound } from '@tsed/exceptions';
import { Prisma, TEST_OPTION } from '@/generated/prisma';
import { BasicSearch, BasicSearchSchema } from '@/inputs';
import {
  CreateTestInput,
  CreateTestInputSchema,
  SubmitTestInput,
  SubmitTestInputSchema,
  UpdateTestInput,
  UpdateTestInputSchema,
} from '@/inputs/test.input';

@Injectable()
export class TestService {
  @InjectContext()
  private context!: PlatformContext;

  get req() {
    return this.context.getRequest<Request>();
  }

  get user() {
    return this.req.user;
  }

  async pagination(query: BasicSearch, subject?: string) {
    const search = BasicSearchSchema.parse(query);
    const where = this.buildWhere(search.search);

    if (subject && subject.trim()) {
      where.subject = subject.trim();
    }

    const [tests, count] = await prisma.$transaction([
      prisma.tests.findMany({
        where,
        take: search.size,
        skip: search.skip,
        select: {
          id: true,
          name: true,
          description: true,
          subject: true,
          duration_minutes: true,
          created_at: true,
          _count: { select: { questions: true } },
        },
        orderBy: [search.sorting, { id: 'asc' }] as Prisma.TestsOrderByWithRelationInput[],
      }),
      prisma.tests.count({ where }),
    ]);

    return { success: true, data: { items: tests, count } };
  }

  async get(id: string) {
    const test = await prisma.tests.findUnique({
      where: { id },
      include: {
        questions: {
          orderBy: { order: 'asc' },
          select: {
            id: true,
            text: true,
            option_a: true,
            option_b: true,
            option_c: true,
            option_d: true,
            order: true,
            correct_option: !!this.user?.isAdmin,
          },
        },
        _count: { select: { questions: true } },
      },
    });

    if (!test) {
      throw new NotFound('test not found');
    }

    return { success: true, data: test };
  }

  async create(input: CreateTestInput) {
    const data = CreateTestInputSchema.parse(input);

    const test = await prisma.tests.create({
      data: {
        name: data.name,
        description: data.description,
        subject: data.subject,
        duration_minutes: data.duration_minutes,
        questions: {
          create: data.questions.map((question, index) => ({ ...question, order: index })),
        },
      },
      include: { questions: { orderBy: { order: 'asc' } } },
    });

    return { success: true, _message: 'saved', data: test };
  }

  async update(id: string, input: UpdateTestInput) {
    const data = UpdateTestInputSchema.parse(input);

    const test = await prisma.tests.findUnique({ where: { id } });

    if (!test) {
      throw new NotFound('test not found');
    }

    const updated = await prisma.$transaction(async tx => {
      await tx.tests.update({
        where: { id },
        data: {
          name: data.name,
          description: data.description,
          subject: data.subject,
          duration_minutes: data.duration_minutes,
          active: data.active,
        },
      });

      if (data.questions) {
        await tx.questions.deleteMany({ where: { test_id: id } });
        await tx.questions.createMany({
          data: data.questions.map((question, index) => ({ ...question, test_id: id, order: index })),
        });
      }

      return tx.tests.findUnique({ where: { id }, include: { questions: { orderBy: { order: 'asc' } } } });
    });

    return { success: true, _message: 'saved', data: updated };
  }

  async delete(id: string) {
    const test = await prisma.tests.findUnique({ where: { id } });

    if (!test) {
      throw new NotFound('test not found');
    }

    await prisma.tests.delete({ where: { id } });

    return { success: true, _message: 'deleted' };
  }

  async submit(testId: string, input: SubmitTestInput) {
    const data = SubmitTestInputSchema.parse(input);

    const test = await prisma.tests.findUnique({
      where: { id: testId },
      include: { questions: true },
    });

    if (!test) {
      throw new NotFound('test not found');
    }

    if (!test.questions.length) {
      throw new BadRequest('this test has no questions');
    }

    const answersByQuestion = new Map(data.answers.map(answer => [answer.question_id, answer.selected_option]));

    let correctCount = 0;

    const answerRows = test.questions.map(question => {
      const selected = (answersByQuestion.get(question.id) ?? null) as TEST_OPTION | null;
      const isCorrect = selected === question.correct_option;

      if (isCorrect) correctCount++;

      return { question_id: question.id, selected_option: selected, is_correct: isCorrect };
    });

    const total = test.questions.length;
    const incorrectCount = total - correctCount;
    const percent = Math.round((correctCount / total) * 10000) / 100;

    const attempt = await prisma.testAttempts.create({
      data: {
        user_id: this.user!.id,
        test_id: testId,
        total_questions: total,
        correct_count: correctCount,
        incorrect_count: incorrectCount,
        score: correctCount,
        percent,
        duration_seconds: data.duration_seconds,
        answers: { create: answerRows },
      },
      select: {
        id: true,
        total_questions: true,
        correct_count: true,
        incorrect_count: true,
        score: true,
        percent: true,
        duration_seconds: true,
        created_at: true,
      },
    });

    return { success: true, _message: 'test completed', data: attempt };
  }

  private buildWhere(term?: string | null): Prisma.TestsWhereInput {
    const where: Prisma.TestsWhereInput = { active: true };

    if (term && term.trim()) {
      const contains = { contains: term.trim(), mode: Prisma.QueryMode.insensitive };
      where.OR = [{ name: contains }, { subject: contains }, { description: contains }];
    }

    return where;
  }
}
