import Redis, { type RedisOptions } from 'ioredis';
import config from '@/config';

const RECONNECT_MAX_DELAY = 5000;

const baseOptions: RedisOptions = {
  lazyConnect: true,
  enableOfflineQueue: false,
  enableReadyCheck: true,
  maxRetriesPerRequest: 1,
  connectTimeout: 1000,
  retryStrategy: (attempt) => Math.min(attempt * 500, RECONNECT_MAX_DELAY),
};

const LOG_THROTTLE_MS = 30_000;
let lastLoggedAt = 0;

function attachLogging(client: Redis, label: string): Redis {
  client.on('error', (error: Error) => {
    const now = Date.now();
    if (now - lastLoggedAt < LOG_THROTTLE_MS) return;

    lastLoggedAt = now;
    console.warn(`[redis:${label}] ${error.message} — Redis'siz davom etilmoqda`);
  });

  return client;
}

function create(label: string, options: RedisOptions = {}): Redis {
  const client = new Redis(config.redis.url, { ...baseOptions, ...options });

  client.connect().catch(() => undefined);

  return attachLogging(client, label);
}

if (!global.__redis) {
  global.__redis = create('shared');
}

export const redis: Redis = global.__redis;

export function createQueueConnection(): Redis {
  return attachLogging(
    new Redis(config.redis.url, {
      ...baseOptions,
      lazyConnect: false,
      enableOfflineQueue: true,
      maxRetriesPerRequest: null,
      enableReadyCheck: false,
    }),
    'queue',
  );
}

export function isRedisReady(): boolean {
  return redis.status === 'ready';
}

export async function pingRedis(): Promise<boolean> {
  if (!isRedisReady()) return false;

  try {
    return (await redis.ping()) === 'PONG';
  } catch {
    return false;
  }
}

export default redis;
