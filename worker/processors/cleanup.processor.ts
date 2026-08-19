import type { Job } from 'bullmq';
import { SUBSCRIPTION_STATUS } from '../../generated/prisma';
import prisma from '@/modules/db';
import { deleteObject } from '@/modules/storage';
import type { CleanupJob } from '@/modules/queue';

const PURGE_AFTER_DAYS = 30;
const BATCH_SIZE = 200;

export async function processCleanup(job: Job<CleanupJob>): Promise<Record<string, number>> {
  switch (job.data.task) {
    case 'purge-deleted-projects':
      return purgeDeletedProjects();
    case 'expire-subscriptions':
      return expireSubscriptions();
    default:
      return {};
  }
}

export async function purgeExpiredExports(): Promise<{ removed: number }> {
  const expired = await prisma.projectExport.findMany({
    where: { expires_at: { lt: new Date() } },
    take: BATCH_SIZE,
  });

  let removed = 0;

  for (const item of expired) {
    try {
      await deleteObject(item.storage_key);
    } catch (error) {
      console.warn(`cleanup: ${item.storage_key} o'chmadi —`, (error as Error).message);
    }

    await prisma.projectExport.delete({ where: { id: item.id } });
    removed += 1;
  }

  return { removed };
}

async function purgeDeletedProjects(): Promise<{ projects: number; exports: number }> {
  const deadline = new Date();
  deadline.setDate(deadline.getDate() - PURGE_AFTER_DAYS);

  const doomed = await prisma.project.findMany({
    where: { deleted_at: { lt: deadline } },
    select: { id: true, exports: { select: { id: true, storage_key: true } } },
    take: BATCH_SIZE,
  });

  let removedExports = 0;

  for (const project of doomed) {
    for (const item of project.exports) {
      try {
        await deleteObject(item.storage_key);
        removedExports += 1;
      } catch {
      }
    }
  }

  const { count } = await prisma.project.deleteMany({
    where: { id: { in: doomed.map((project) => project.id) } },
  });

  const expired = await purgeExpiredExports();

  return { projects: count, exports: removedExports + expired.removed };
}

async function expireSubscriptions(): Promise<{ expired: number }> {
  const { count } = await prisma.subscription.updateMany({
    where: {
      status: SUBSCRIPTION_STATUS.ACTIVE,
      period_end: { lt: new Date() },
    },
    data: { status: SUBSCRIPTION_STATUS.EXPIRED },
  });

  return { expired: count };
}
