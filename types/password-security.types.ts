import type { MessageCode } from '@/utils/messages';

interface PasswordVerdict {
  ok: boolean;
  score: 0 | 1 | 2 | 3 | 4;
  /** Translation code when `ok` is false. */
  code?: MessageCode;
  /** Values the translated message interpolates. */
  values?: Record<string, string | number>;
  breached: boolean;
}

export type { PasswordVerdict };
