import { Controller, Inject } from '@tsed/di';
import { PathParams, QueryParams } from '@tsed/platform-params';
import { Get } from '@tsed/schema';
import { Authenticate, Authorized } from '@/middlewares/auth.middleware';
import { ResultService } from '@/services/result.service';
import { BasicSearch } from '@/inputs';

@Controller('/results')
export class ResultController {
  @Inject()
  private resultService!: ResultService;

  @Get('/paginated')
  @Authorized(Authenticate())
  async pagination(@QueryParams() query: BasicSearch) {
    return await this.resultService.pagination(query);
  }

  @Get('/:id')
  @Authorized(Authenticate())
  async get(@PathParams('id') id: string) {
    return await this.resultService.get(id);
  }
}
