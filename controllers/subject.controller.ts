import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams } from '@tsed/platform-params';
import { Delete, Get, Post } from '@tsed/schema';
import { AdminOnly, Authenticate, Authorized } from '@/middlewares/auth.middleware';
import { SubjectService } from '@/services/subject.service';
import { CreateSubjectInput } from '@/inputs/subject.input';

@Controller('/subjects')
export class SubjectController {
  @Inject()
  private subjectService!: SubjectService;

  @Get('/')
  @Authorized(Authenticate())
  async list() {
    return await this.subjectService.list();
  }

  @Post('')
  @Authorized(AdminOnly())
  async create(@BodyParams() data: CreateSubjectInput) {
    return await this.subjectService.create(data);
  }

  @Delete('/:id')
  @Authorized(AdminOnly())
  async delete(@PathParams('id') id: string) {
    return await this.subjectService.delete(id);
  }
}
