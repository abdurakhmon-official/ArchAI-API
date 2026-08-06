import { Controller } from '@tsed/di';
import { Get } from '@tsed/schema';

@Controller('/health')
export class HealthController {
  @Get('/')
  check() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
    };
  }
}
