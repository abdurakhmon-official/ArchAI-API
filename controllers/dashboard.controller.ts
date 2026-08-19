import { Controller, Inject } from '@tsed/di';
import { Get, Summary } from '@tsed/schema';
import { AdminOnly, Authenticate, Authorized } from '@/middlewares/auth.middleware';
import { DashboardService } from '@/services/dashboard.service';

@Controller('/dashboard')
export class DashboardController {
  @Inject()
  private dashboardService!: DashboardService;

  @Get('/stats')
  @Authorized(Authenticate())
  async stats() {
    return await this.dashboardService.stats();
  }

  @Get('/admin')
  @Authorized(AdminOnly())
  async adminStats() {
    return await this.dashboardService.adminStats();
  }
}
