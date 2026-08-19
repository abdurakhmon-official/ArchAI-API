import type { JobState, JobStatus } from '@/types/job.types';
import { Injectable } from '@tsed/di';
import { badRequest, notFound } from '@/utils/errors';
import { EXPORT_KIND } from '../generated/prisma';
import prisma from '@/modules/db';
import { pdfQueue, renderQueue, queues, type QueueName } from '@/modules/queue';
import { isRedisReady } from '@/modules/redis';
import { presignDownload } from '@/modules/storage';

const JOB_ID_SEPARATOR = '-';

function jobIdOf(queue: string, ...parts: string[]): string {
  return [queue, ...parts].join(JOB_ID_SEPARATOR);
}

@Injectable()
export class JobService {
  async requestPdf(
    projectId: string,
    geometryHash: string,
    watermark: boolean,
    locale = 'uz',
  ): Promise<{ ready: boolean; url?: string; jobId?: string }> {
    const existing = await prisma.projectExport.findUnique({
      where: {
        project_id_kind_geometry_hash_watermark: {
          project_id: projectId,
          kind: EXPORT_KIND.PDF,
          geometry_hash: geometryHash,
          watermark,
        },
      },
    });

    if (existing && (!existing.expires_at || existing.expires_at > new Date())) {
      return { ready: true, url: await presignDownload(existing.storage_key) };
    }

    this.assertQueueAvailable();

    const jobId = jobIdOf('pdf', projectId, geometryHash, watermark ? 'w' : 'c');
    await pdfQueue.add('generate', { projectId, geometryHash, watermark, locale }, { jobId });

    return { ready: false, jobId };
  }

  async requestRender(
    projectId: string,
    geometryHash: string,
    view: 'exterior' | 'cutaway' | 'interior',
  ): Promise<{ ready: boolean; url?: string; jobId?: string }> {
    const hash = `${geometryHash}:${view}`;

    const existing = await prisma.projectExport.findUnique({
      where: {
        project_id_kind_geometry_hash_watermark: {
          project_id: projectId,
          kind: EXPORT_KIND.RENDER,
          geometry_hash: hash,
          watermark: false,
        },
      },
    });

    if (existing && (!existing.expires_at || existing.expires_at > new Date())) {
      return { ready: true, url: await presignDownload(existing.storage_key) };
    }

    this.assertQueueAvailable();

    const jobId = jobIdOf('render', projectId, geometryHash, view);
    await renderQueue.add('generate', { projectId, geometryHash, view }, { jobId });

    return { ready: false, jobId };
  }

  async status(jobId: string): Promise<JobStatus> {
    const queueName = jobId.split(JOB_ID_SEPARATOR)[0] as QueueName;
    const queue = queues[queueName];

    if (!queue) throw badRequest('JOB_NOT_FOUND', `unknown queue in job id: ${jobId}`);

    const job = await queue.getJob(jobId);
    if (!job) throw notFound('JOB_NOT_FOUND', 'job not found, it may have expired');

    const state = (await job.getState()) as JobState;
    const progress = typeof job.progress === 'number' ? job.progress : 0;

    if (state === 'completed') {
      const result = job.returnvalue as { key?: string } | undefined;

      return {
        id: jobId,
        queue: queueName,
        state,
        progress: 100,
        url: result?.key ? await presignDownload(result.key) : undefined,
      };
    }

    return {
      id: jobId,
      queue: queueName,
      state,
      progress,
      error: state === 'failed' ? (job.failedReason ?? 'unknown error') : undefined,
    };
  }

  private assertQueueAvailable(): void {
    if (!isRedisReady()) {
      throw badRequest('QUEUE_UNAVAILABLE', 'file generation is temporarily unavailable');
    }
  }
}
