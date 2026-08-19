import { Controller } from '@tsed/di';
import { Get, Summary } from '@tsed/schema';
import prisma from '@/modules/db';
import { pingRedis } from '@/modules/redis';
import { storageDriver } from '@/modules/storage';
import config from '@/config';

const PROBE_TIMEOUT_MS = 2000;

@Controller('/health')
export class HealthController {
  @Get('/')
  check() {
    return {
      status: 'ok',
      uptime: Math.round(process.uptime()),
      stage: config.stage,
    };
  }

  @Get('/ready')
  async ready() {
    const [database, redis] = await Promise.all([this.checkDatabase(), this.checkRedis()]);

    const storage = storageDriver();
    const healthy = database.ok;

    return {
      status: healthy ? (redis.ok ? 'ok' : 'degraded') : 'unhealthy',
      uptime: Math.round(process.uptime()),
      stage: config.stage,
      checks: {
        database,
        redis,
        storage: {
          ok: true,
          driver: storage,
          note: storage === 'local' ? 'fayllar diskda — S3 sozlanmagan' : undefined,
        },
      },
    };
  }

  private async checkDatabase() {
    const started = Date.now();

    try {
      await this.withTimeout(prisma.$queryRaw`SELECT 1`);
      return { ok: true, latencyMs: Date.now() - started };
    } catch (error) {
      return { ok: false, latencyMs: Date.now() - started, error: (error as Error).message };
    }
  }

  private async checkRedis() {
    const started = Date.now();

    try {
      const ok = await this.withTimeout(pingRedis());
      return { ok, latencyMs: Date.now() - started };
    } catch {
      return { ok: false, latencyMs: Date.now() - started };
    }
  }

  private withTimeout<T>(promise: Promise<T>): Promise<T> {
    return Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error('probe timeout')), PROBE_TIMEOUT_MS),
      ),
    ]);
  }
}
