import { Injectable } from '@tsed/di';
import { AccessTokenPayload } from '@/modules/auth';
import { isRedisReady, redis } from '@/modules/redis';

/**
 * Bekor qilingan tokenlar ro'yxati.
 *
 * JWT o'zi bekor qilinmaydi — imzo to'g'ri bo'lsa u muddati
 * tugagunicha yaroqli. Chiqish va parol almashtirish ishlashi uchun
 * "bu identifikator endi yaramaydi" degan ro'yxat kerak.
 *
 * Ro'yxat REDIS'da. Ilgari u jarayon xotirasidagi `Map` edi va bu ikki
 * holatda buzilardi:
 *   - server qayta ishga tushsa, bekor qilingan tokenlar TIRILARDI —
 *     ya'ni chiqqan odam yana ichkarida bo'lib qolardi;
 *   - bir nechta nusxa ishlaganda bittasida chiqish qilingani
 *     boshqalariga umuman yetib bormasdi.
 *
 * Redis ishlamayotgan bo'lsa xotiradagi ro'yxatga tushiladi: bu ideal
 * emas, lekin chiqishni butunlay ishlamaydigan qilishdan yaxshiroq.
 * Xuddi `utils/login-guard.ts` dagi naqsh.
 */

/** Redis kalitining prefiksi. */
const PREFIX = 'revoked:';

/** Zaxira ro'yxat cheksiz o'smasin. */
const MAX_LOCAL_ENTRIES = 10_000;

@Injectable()
export class TokenService {
  /** Redis ishlamaganda ishlatiladigan zaxira. */
  private readonly local = new Map<string, number>();
  private sweeper?: NodeJS.Timeout;
  private static readonly SWEEP_INTERVAL_MS = 5 * 60 * 1000;

  $onInit() {
    this.sweeper = setInterval(() => this.sweep(), TokenService.SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  $onDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  /**
   * Tokenni bekor qiladi.
   *
   * Yozuv tokenning O'Z muddatiga qo'yiladi: undan keyin u baribir
   * yaroqsiz bo'ladi va ro'yxatda saqlashning ma'nosi yo'q.
   */
  async revoke(payload: Pick<AccessTokenPayload, 'jti' | 'exp'>): Promise<void> {
    if (!payload.jti) return;

    const ttl = payload.exp - this.now();
    if (ttl <= 0) return;

    if (isRedisReady()) {
      try {
        await redis.set(PREFIX + payload.jti, '1', 'EX', ttl);
        return;
      } catch {
        // Quyida zaxiraga tushamiz.
      }
    }

    this.remember(payload.jti, payload.exp);
  }

  async isRevoked(jti?: string): Promise<boolean> {
    if (!jti) return false;

    if (isRedisReady()) {
      try {
        if ((await redis.exists(PREFIX + jti)) === 1) return true;
      } catch {
        // Zaxirani ham tekshiramiz.
      }
    }

    const expiresAt = this.local.get(jti);
    if (expiresAt === undefined) return false;

    if (expiresAt <= this.now()) {
      this.local.delete(jti);
      return false;
    }

    return true;
  }

  private remember(jti: string, expiresAt: number) {
    // To'lib ketsa eng eskisi chiqariladi — `Map` kiritish tartibini
    // saqlaydi, ya'ni birinchi kalit eng eskisi.
    if (this.local.size >= MAX_LOCAL_ENTRIES) {
      const oldest = this.local.keys().next().value;
      if (oldest !== undefined) this.local.delete(oldest);
    }

    this.local.set(jti, expiresAt);
  }

  private sweep() {
    const now = this.now();

    for (const [jti, expiresAt] of this.local) {
      if (expiresAt <= now) this.local.delete(jti);
    }
  }

  private now() {
    return Math.floor(Date.now() / 1000);
  }
}
