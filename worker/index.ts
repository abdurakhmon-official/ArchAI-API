import { config as loadDotEnv } from 'dotenv';
loadDotEnv();

import { Worker, type Job } from 'bullmq';
import config from '@/config';
import prisma from '@/modules/db';
import { createQueueConnection } from '@/modules/redis';
import { cleanupQueue, QUEUE_NAMES } from '@/modules/queue';
import { closeBrowser } from '@/worker/lib/browser';
import { processCleanup } from '@/worker/processors/cleanup.processor';
import { processEmail } from '@/worker/processors/email.processor';
import { processPdf } from '@/worker/processors/pdf.processor';
import { processRender } from '@/worker/processors/render.processor';

const CONCURRENCY = {
  pdf: Number(process.env.WORKER_PDF_CONCURRENCY) || 2,
  render: Number(process.env.WORKER_RENDER_CONCURRENCY) || 1,
  email: 5,
  cleanup: 1,
};

const CLEANUP_CRON = '0 3 * * *';

const connection = createQueueConnection();
const workers: Worker[] = [];

function register<T>(
  name: string,
  processor: (job: Job<T>) => Promise<unknown>,
  concurrency: number,
): void {
  const worker = new Worker<T>(name, processor, { connection, concurrency });

  worker.on('completed', (job, result) => {
    console.info(`[${name}] ${job.id} tugadi`, summarize(result));
  });

  worker.on('failed', (job, error) => {
    const attempts = job ? `${job.attemptsMade}/${job.opts.attempts ?? 1}` : '?';
    console.error(`[${name}] ${job?.id} yiqildi (${attempts}): ${error.message}`);
  });

  worker.on('error', (error) => {
    console.error(`[${name}] worker failed: ${error.message}`);
  });

  workers.push(worker);
}

async function bootstrap(): Promise<void> {
  console.info(`======= WORKER · STAGE: ${config.stage} =======`);

  register(QUEUE_NAMES.pdf, processPdf, CONCURRENCY.pdf);
  register(QUEUE_NAMES.render, processRender, CONCURRENCY.render);
  register(QUEUE_NAMES.email, processEmail, CONCURRENCY.email);
  register(QUEUE_NAMES.cleanup, processCleanup, CONCURRENCY.cleanup);

  await cleanupQueue.upsertJobScheduler(
    'cleanup-nightly',
    { pattern: CLEANUP_CRON },
    { name: 'nightly', data: { task: 'purge-deleted-projects' } },
  );

  await cleanupQueue.upsertJobScheduler(
    'cleanup-subscriptions',
    { pattern: CLEANUP_CRON },
    { name: 'subscriptions', data: { task: 'expire-subscriptions' } },
  );

  console.info(
    `navbatlar tinglanmoqda: ${Object.values(QUEUE_NAMES).join(', ')} ` +
      `(pdf=${CONCURRENCY.pdf}, render=${CONCURRENCY.render})`,
  );
}

async function shutdown(signal: string): Promise<void> {
  console.info(`\n${signal} — worker to'xtatilmoqda…`);

  const timeout = setTimeout(() => {
    console.error('to\'xtatish cho\'zilib ketdi — majburan chiqilmoqda');
    process.exit(1);
  }, 30_000);

  try {
    await Promise.all(workers.map((worker) => worker.close()));
    await closeBrowser();
    await connection.quit();
    await prisma.$disconnect();
    clearTimeout(timeout);
    console.info('worker to\'xtadi');
    process.exit(0);
  } catch (error) {
    clearTimeout(timeout);
    console.error('failed to shut down:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

process.on('unhandledRejection', (reason) => {
  console.error('ushlanmagan rad etish:', reason);
});

bootstrap().catch((error) => {
  console.error('worker ishga tushmadi:', error);
  process.exit(1);
});

function summarize(result: unknown): string {
  if (!result || typeof result !== 'object') return '';
  return JSON.stringify(result).slice(0, 120);
}
