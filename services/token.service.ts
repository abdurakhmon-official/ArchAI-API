import { Injectable } from '@tsed/di';
import { AccessTokenPayload } from '@/modules/auth';

@Injectable()
export class TokenService {
  private readonly revoked = new Map<string, number>();
  private sweeper?: NodeJS.Timeout;
  private static readonly SWEEP_INTERVAL_MS = 5 * 60 * 1000;

  $onInit() {
    this.sweeper = setInterval(() => this.sweep(), TokenService.SWEEP_INTERVAL_MS);
    this.sweeper.unref();
  }

  $onDestroy() {
    if (this.sweeper) clearInterval(this.sweeper);
  }

  revoke(payload: Pick<AccessTokenPayload, 'jti' | 'exp'>) {
    if (!payload.jti) return;
    this.revoked.set(payload.jti, payload.exp);
  }

  isRevoked(jti?: string): boolean {
    if (!jti) return false;

    const expiresAt = this.revoked.get(jti);
    if (expiresAt === undefined) return false;

    if (expiresAt <= this.now()) {
      this.revoked.delete(jti);
      return false;
    }

    return true;
  }

  private sweep() {
    const now = this.now();

    for (const [jti, expiresAt] of this.revoked) {
      if (expiresAt <= now) this.revoked.delete(jti);
    }
  }

  private now() {
    return Math.floor(Date.now() / 1000);
  }
}
