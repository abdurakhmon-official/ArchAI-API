import { Queue, type JobsOptions } from 'bullmq';
import { createQueueConnection } from '@/modules/redis';

export const QUEUE_NAMES = {
  render: 'render',
  pdf: 'pdf',
  email: 'email',
  cleanup: 'cleanup',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export interface RenderJob {
  projectId: string;
  geometryHash: string;
  view: 'exterior' | 'cutaway' | 'interior';
  roomId?: string;
}

export interface PdfJob {
  projectId: string;
  geometryHash: string;
  locale: string;
  watermark: boolean;
}

export interface EmailJob {
  to: string;
  template: 'verify' | 'reset' | 'subscription' | 'welcome';
  locale: string;
  payload: Record<string, unknown>;
}

export interface CleanupJob {
  task: 'purge-deleted-projects' | 'expire-subscriptions';
}

export const DEFAULT_JOB_OPTIONS: JobsOptions = {
  attempts: 3,
  backoff: { type: 'exponential', delay: 2000 },
  removeOnComplete: { age: 3600, count: 500 },
  removeOnFail: { age: 86400 },
};

const connection = createQueueConnection();

const LOG_THROTTLE_MS = 30_000;
const lastLogged = new Map<string, number>();

interface Emitter {
  on(event: 'error', listener: (error: Error) => void): unknown;
}

function guard(queue: Emitter, name: string): void {
  queue.on('error', (error: Error) => {
    const now = Date.now();
    if (now - (lastLogged.get(name) ?? 0) < LOG_THROTTLE_MS) return;

    lastLogged.set(name, now);
    console.warn(`[queue:${name}] ${error.message} — navbatsiz davom etilmoqda`);
  });
}

export const renderQueue = new Queue<RenderJob>(QUEUE_NAMES.render, {
  connection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const pdfQueue = new Queue<PdfJob>(QUEUE_NAMES.pdf, {
  connection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
});

export const emailQueue = new Queue<EmailJob>(QUEUE_NAMES.email, {
  connection,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 5 },
});

export const cleanupQueue = new Queue<CleanupJob>(QUEUE_NAMES.cleanup, {
  connection,
  defaultJobOptions: { ...DEFAULT_JOB_OPTIONS, attempts: 1 },
});

guard(renderQueue, QUEUE_NAMES.render);
guard(pdfQueue, QUEUE_NAMES.pdf);
guard(emailQueue, QUEUE_NAMES.email);
guard(cleanupQueue, QUEUE_NAMES.cleanup);

export const queues = {
  [QUEUE_NAMES.render]: renderQueue,
  [QUEUE_NAMES.pdf]: pdfQueue,
  [QUEUE_NAMES.email]: emailQueue,
  [QUEUE_NAMES.cleanup]: cleanupQueue,
};

export async function closeQueues(): Promise<void> {
  await Promise.all(Object.values(queues).map((queue) => queue.close()));
  await connection.quit();
}
