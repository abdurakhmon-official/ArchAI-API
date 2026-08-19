import { $log } from '@tsed/common';
import { PlatformExpress } from '@tsed/platform-express';
import { assertConfig } from './config/validate';
import prisma from './modules/db';
import { Server } from './server';

const SHUTDOWN_TIMEOUT_MS = 15_000;

async function bootstrap() {
  assertConfig();

  try {
    const platform = await PlatformExpress.bootstrap(Server);
    await platform.listen();

    let stopping = false;

    const shutdown = async (signal: string) => {
      if (stopping) return;
      stopping = true;

      $log.info(`${signal} — server to'xtatilmoqda…`);

      const timer = setTimeout(() => {
        $log.error('to\'xtatish cho\'zilib ketdi — majburan chiqilmoqda');
        process.exit(1);
      }, SHUTDOWN_TIMEOUT_MS);

      try {
        await platform.stop();
        await prisma.$disconnect();
        clearTimeout(timer);
        $log.info('server to\'xtadi');
        process.exit(0);
      } catch (error) {
        clearTimeout(timer);
        $log.error({ event: 'SHUTDOWN_ERROR', error });
        process.exit(1);
      }
    };

    process.on('SIGTERM', () => void shutdown('SIGTERM'));
    process.on('SIGINT', () => void shutdown('SIGINT'));
  } catch (error: any) {
    $log.error({ event: 'SERVER_BOOTSTRAP_ERROR', message: error.message, stack: error.stack });
    process.exit(1);
  }
}

bootstrap();
