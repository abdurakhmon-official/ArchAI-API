import { isRedisReady, redis } from '@/modules/redis';

interface Attempt {
  count: number;
  expiresAt: number;
}

const MAX_FAILURES = 10;
const WINDOW_SECONDS = 15 * 60;
const TIMEOUT_MS = 150;
const MAX_LOCAL_ENTRIES = 10_000;

const keyFor = (email: string) => `login:fail:${email.toLowerCase()}`;
const local = new Map<string, Attempt>();

const withTimeout = <T>(promise: Promise<T>): Promise<T> => {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => setTimeout(() => reject(new Error('redis timeout')), TIMEOUT_MS)),
  ]);
}

const localRead = (key: string): Attempt | null => {
  const entry = local.get(key);
  if (!entry) return null;

  if (entry.expiresAt <= Date.now()) {
    local.delete(key);
    return null;
  }

  return entry;
}

const localWrite = (key: string): void => {
  if (local.size >= MAX_LOCAL_ENTRIES) {
    for (const [candidate, entry] of local) {
      if (entry.expiresAt <= Date.now()) local.delete(candidate);
    }

    if (local.size >= MAX_LOCAL_ENTRIES) {
      const oldest = local.keys().next().value;
      if (oldest) local.delete(oldest);
    }
  }

  const existing = localRead(key);

  local.set(key, {
    count: (existing?.count ?? 0) + 1,
    expiresAt: existing?.expiresAt ?? Date.now() + WINDOW_SECONDS * 1000,
  });
}

export async function loginBlockedFor(email: string): Promise<number> {
  const key = keyFor(email);

  if (isRedisReady()) {
    try {
      const [count, ttl] = (await withTimeout(
        redis.multi().get(key).ttl(key).exec(),
      )) as Array<[Error | null, string | number | null]>;

      const failures = Number(count[1] ?? 0);
      if (failures < MAX_FAILURES) return 0;

      const remaining = Number(ttl[1] ?? 0);
      return remaining > 0 ? remaining : WINDOW_SECONDS;
    } catch {
    }
  }

  const entry = localRead(key);
  if (!entry || entry.count < MAX_FAILURES) return 0;

  return Math.max(1, Math.ceil((entry.expiresAt - Date.now()) / 1000));
}

export async function recordLoginFailure(email: string): Promise<void> {
  const key = keyFor(email);

  localWrite(key);

  if (!isRedisReady()) return;

  try {
    const [count] = (await withTimeout(redis.multi().incr(key).exec())) as Array<
      [Error | null, number]
    >;

    if (count[1] === 1) await withTimeout(redis.expire(key, WINDOW_SECONDS));
  } catch {
  }
}

export async function clearLoginFailures(email: string): Promise<void> {
  const key = keyFor(email);
  local.delete(key);

  if (!isRedisReady()) return;

  try {
    await withTimeout(redis.del(key));
  } catch {
  }
}

export const LOGIN_GUARD = { MAX_FAILURES, WINDOW_SECONDS };
