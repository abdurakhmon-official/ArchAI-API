import { Req, Res } from '@tsed/common';
import { useDecorators } from '@tsed/core';
import { Exception } from '@tsed/exceptions';
import { Middleware, MiddlewareMethods, UseAuth } from '@tsed/platform-middlewares';
import { Context } from '@tsed/platform-params';
import { Returns } from '@tsed/schema';
import type { Request, Response } from 'express';
import { isRedisReady, redis } from '@/modules/redis';
import type { MessageCode } from '@/utils/messages';

const REDIS_TIMEOUT_MS = 150;

function withTimeout<T>(promise: Promise<T>): Promise<T> {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) =>
      setTimeout(() => reject(new Error('redis timeout')), REDIS_TIMEOUT_MS),
    ),
  ]);
}

export interface RateLimitOptions extends Record<string, unknown> {
  windowSeconds: number;
  max: number;
  bucket: string;
}

export class TooManyRequests extends Exception {
  static readonly STATUS = 429;
  readonly code = 'RATE_LIMIT';

  readonly _code: MessageCode;

  constructor(
    message: string,
    meta: { retryAfter: number; limit: number },
    code: MessageCode = 'RATE_LIMITED',
    values: Record<string, unknown> = {},
  ) {
    super(429, message);
    this._code = code;
    this.meta = { ...meta, ...values };
  }

  readonly meta: Record<string, unknown>;
}

@Middleware()
export class RateLimitMiddleware implements MiddlewareMethods {
  async use(@Req() request: Req, @Res() response: Res, @Context() ctx: Context) {
    const options: RateLimitOptions | undefined = ctx.endpoint.get(RateLimitMiddleware);
    if (!options) return true;

    if (!isRedisReady()) return true;

    const key = `rl:${options.bucket}:${identify(request as unknown as Request)}`;

    let used: number;
    let ttl: number;

    try {
      const [count, remaining] = (await withTimeout(
        redis.multi().incr(key).ttl(key).exec(),
      )) as Array<[Error | null, number]>;

      used = count[1];
      ttl = remaining[1];

      if (ttl < 0) {
        await withTimeout(redis.expire(key, options.windowSeconds));
        ttl = options.windowSeconds;
      }
    } catch {
      return true;
    }

    const res = response as unknown as Response;
    res.setHeader('X-RateLimit-Limit', String(options.max));
    res.setHeader('X-RateLimit-Remaining', String(Math.max(0, options.max - used)));
    res.setHeader('X-RateLimit-Reset', String(ttl));

    if (used > options.max) {
      res.setHeader('Retry-After', String(ttl));
      throw new TooManyRequests(
        `rate limit exceeded, try again in ${ttl} seconds`,
        { retryAfter: ttl, limit: options.max },
        'RATE_LIMITED',
        { seconds: ttl },
      );
    }

    return true;
  }
}

function identify(request: Request): string {
  if (request.user?.id) return `u:${request.user.id}`;

  const forwarded = request.headers['x-forwarded-for'];
  const ip = Array.isArray(forwarded)
    ? forwarded[0]
    : (forwarded?.split(',')[0].trim() ?? request.ip ?? 'unknown');

  return `ip:${ip}`;
}

export function RateLimit(options: RateLimitOptions): Function {
  return useDecorators(
    UseAuth(RateLimitMiddleware, options),
    Returns(429).Description('so\'rovlar chegarasi — javobda `Retry-After` sarlavhasi keladi'),
  );
}

export const RATE_LIMITS = {
  generate: { bucket: 'generate', windowSeconds: 60, max: 20 },
  geometry: { bucket: 'geometry', windowSeconds: 60, max: 120 },
  estimate: { bucket: 'estimate', windowSeconds: 60, max: 60 },
  auth: { bucket: 'auth', windowSeconds: 300, max: 15 },
  lead: { bucket: 'lead', windowSeconds: 3600, max: 5 },
  /*
    Parolni tiklash — `auth` dan qattiqroq.

    Har so'rov XAT yuboradi, ya'ni chegara faqat serverni emas,
    begona odamning pochta qutisini ham himoya qiladi: kimdir
    boshqaning manzilini kiritib, uni xat bilan ko'mib tashlashi
    mumkin edi.
  */
  passwordReset: { bucket: 'pwreset', windowSeconds: 3600, max: 5 },
  upload: { bucket: 'upload', windowSeconds: 300, max: 30 },
  admin: { bucket: 'admin', windowSeconds: 60, max: 120 },
  adminHeavy: { bucket: 'admin-heavy', windowSeconds: 3600, max: 5 },
} as const satisfies Record<string, RateLimitOptions>;
