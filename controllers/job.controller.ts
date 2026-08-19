import { Controller, Inject } from '@tsed/di';
import { PathParams } from '@tsed/platform-params';
import { Get, Summary } from '@tsed/schema';
import { Authenticate, Authorized } from '@/middlewares/auth.middleware';
import { JobService } from '@/services/job.service';

@Controller('/jobs')
export class JobController {
  @Inject()
  private jobService!: JobService;

  @Get('/:id')
  @Authorized(Authenticate())
  async status(@PathParams('id') id: string) {
    return { success: true, data: await this.jobService.status(id) };
  }
}
