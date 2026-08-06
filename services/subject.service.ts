import prisma from '@/modules/db';
import { Injectable } from '@tsed/di';
import { BadRequest, NotFound } from '@tsed/exceptions';
import { CreateSubjectInput, CreateSubjectInputSchema } from '@/inputs/subject.input';

@Injectable()
export class SubjectService {
  async list() {
    const subjects = await prisma.subject.findMany({ orderBy: { name: 'asc' } });
    return { success: true, data: subjects };
  }

  async create(input: CreateSubjectInput) {
    const data = CreateSubjectInputSchema.parse(input);

    const existing = await prisma.subject.findUnique({ where: { name: data.name } });
    if (existing) {
      throw new BadRequest('this subject already exists');
    }

    const subject = await prisma.subject.create({ data });
    return { success: true, _message: 'subject added', data: subject };
  }

  async delete(id: string) {
    const subject = await prisma.subject.findUnique({ where: { id } });
    if (!subject) {
      throw new NotFound('subject not found');
    }

    await prisma.subject.delete({ where: { id } });
    return { success: true, _message: 'subject removed' };
  }
}
