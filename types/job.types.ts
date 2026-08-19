import type { QueueName } from '@/modules/queue';

type JobState = 'waiting' | 'active' | 'completed' | 'failed' | 'unknown';

interface JobStatus {
  id: string;
  queue: QueueName;
  state: JobState;
  progress: number;
  url?: string;
  error?: string;
}

export type { JobState, JobStatus };
