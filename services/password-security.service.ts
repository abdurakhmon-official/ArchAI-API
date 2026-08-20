import { createHash } from 'node:crypto';
import { Injectable } from '@tsed/di';
import { Options, ZxcvbnFactory } from '@zxcvbn-ts/core';
import * as zxcvbnCommonPackage from '@zxcvbn-ts/language-common';
import * as zxcvbnEnPackage from '@zxcvbn-ts/language-en';
import { isRedisReady, redis } from '@/modules/redis';
import type { PasswordVerdict } from '@/types/password-security.types';

const MIN_SCORE = 3;
const HIBP_TIMEOUT_MS = 2500;
const HIBP_CACHE_SECONDS = 60 * 60;
const HIBP_CACHE_PREFIX = 'hibp:';

const zxcvbn = new ZxcvbnFactory(
  new Options({
    dictionary: { ...zxcvbnCommonPackage.dictionary, ...zxcvbnEnPackage.dictionary },
    graphs: zxcvbnCommonPackage.adjacencyGraphs,
    translations: zxcvbnEnPackage.translations,
  }),
);

@Injectable()
export class PasswordSecurityService {
  score(password: string, userInputs: (string | null | undefined)[] = []): number {
    return zxcvbn.check(password, userInputs.filter((value): value is string => Boolean(value))).score;
  }

  async check(password: string, userInputs: (string | null | undefined)[] = []): Promise<PasswordVerdict> {
    const result = zxcvbn.check(
      password,
      userInputs.filter((value): value is string => Boolean(value)),
    );

    const breached = await this.isBreached(password);

    if (breached) {
      return { ok: false, score: result.score, code: 'VALIDATION_PASSWORD_BREACHED', breached: true };
    }

    if (result.score < MIN_SCORE) {
      return { ok: false, score: result.score, code: 'VALIDATION_PASSWORD_WEAK', breached: false };
    }

    return { ok: true, score: result.score, breached: false };
  }

  private async isBreached(password: string): Promise<boolean> {
    const sha1 = createHash('sha1').update(password).digest('hex').toUpperCase();
    const prefix = sha1.slice(0, 5);
    const suffix = sha1.slice(5);

    const suffixes = (await this.readCache(prefix)) ?? (await this.fetchRange(prefix));
    if (suffixes === null) return false;

    return suffixes.has(suffix);
  }

  private async fetchRange(prefix: string): Promise<Set<string> | null> {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), HIBP_TIMEOUT_MS);

    try {
      const response = await fetch(`https://api.pwnedpasswords.com/range/${prefix}`, {
        headers: { 'Add-Padding': 'true' },
        signal: controller.signal,
      });

      if (!response.ok) throw new Error(`HIBP responded ${response.status}`);

      const body = await response.text();
      const suffixes = new Set(
        body
          .split('\n')
          .map((line) => line.split(':')[0]?.trim())
          .filter((value): value is string => Boolean(value)),
      );

      await this.writeCache(prefix, suffixes);

      return suffixes;
    } catch (error) {
      console.warn(`[password-security] HIBP unavailable — davom etilmoqda: ${(error as Error).message}`);
      return null;
    } finally {
      clearTimeout(timeout);
    }
  }

  private async readCache(prefix: string): Promise<Set<string> | null> {
    if (!isRedisReady()) return null;

    try {
      const cached = await redis.get(HIBP_CACHE_PREFIX + prefix);
      return cached === null ? null : new Set(cached.length ? cached.split(',') : []);
    } catch {
      return null;
    }
  }

  private async writeCache(prefix: string, suffixes: Set<string>): Promise<void> {
    if (!isRedisReady()) return;

    try {
      await redis.set(HIBP_CACHE_PREFIX + prefix, [...suffixes].join(','), 'EX', HIBP_CACHE_SECONDS);
    } catch {
    }
  }
}
