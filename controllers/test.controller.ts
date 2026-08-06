import { Controller, Inject } from '@tsed/di';
import { BodyParams, PathParams, QueryParams } from '@tsed/platform-params';
import { Delete, Get, Post, Put } from '@tsed/schema';
import { Authenticate, Authorized, TeacherOnly } from '@/middlewares/auth.middleware';
import { TestService } from '@/services/test.service';
import { CreateTestInput, SubmitTestInput, UpdateTestInput } from '@/inputs/test.input';
import { BasicSearch } from '@/inputs';

@Controller('/tests')
export class TestController {
  @Inject()
  private testService!: TestService;

  @Get('/paginated')
  @Authorized(Authenticate())
  async pagination(@QueryParams() query: BasicSearch, @QueryParams('subject') subject?: string) {
    return await this.testService.pagination(query, subject);
  }

  @Get('/:id')
  @Authorized(Authenticate())
  async get(@PathParams('id') id: string) {
    return await this.testService.get(id);
  }

  @Post('')
  @Authorized(TeacherOnly())
  async create(@BodyParams() data: CreateTestInput) {
    return await this.testService.create(data);
  }

  @Put('/:id')
  @Authorized(TeacherOnly())
  async update(@PathParams('id') id: string, @BodyParams() data: UpdateTestInput) {
    return await this.testService.update(id, data);
  }

  @Delete('/:id')
  @Authorized(TeacherOnly())
  async delete(@PathParams('id') id: string) {
    return await this.testService.delete(id);
  }

  @Post('/:id/submit')
  @Authorized(Authenticate())
  async submit(@PathParams('id') id: string, @BodyParams() data: SubmitTestInput) {
    return await this.testService.submit(id, data);
  }
}
