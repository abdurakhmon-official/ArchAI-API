import { createHash } from 'node:crypto';
import { timingSafeEqual } from '@/utils/crypto';

/**
 * Click webhook imzosi.
 *
 * Formula Click'ning o'zi bergan: `md5(click_trans_id + service_id +
 * secret_key + merchant_trans_id [+ merchant_prepare_id, faqat
 * complete'da] + amount + action + sign_time)`. Bitta maydon tartibi
 * yoki mavjudligi o'zgarsa, HAR bir haqiqiy so'rov rad etilib qoladi —
 * shuning uchun bu formula o'zgartirilmaydi.
 */

interface ClickSignatureInput {
  clickTransId: string;
  serviceId: string;
  merchantTransId: string;
  merchantPrepareId?: string;
  amount: number;
  action: number;
  signTime: string;
}

function buildClickSignature(input: ClickSignatureInput, secretKey: string): string {
  const parts = [
    input.clickTransId,
    input.serviceId,
    secretKey,
    input.merchantTransId,
    ...(input.action === 1 ? [input.merchantPrepareId ?? ''] : []),
    String(input.amount),
    String(input.action),
    input.signTime,
  ];

  return createHash('md5').update(parts.join('')).digest('hex');
}

/**
 * `secretKey` bo'sh bo'lsa har doim rad etadi — sozlanmagan provayder
 * uchun "imzo mos keldi" degan yolg'on natija bermaslik uchun.
 */
function verifyClickSignature(
  input: ClickSignatureInput,
  secretKey: string,
  providedSignature: string,
): boolean {
  if (!secretKey) return false;

  const expected = buildClickSignature(input, secretKey);
  return timingSafeEqual(expected, providedSignature.toLowerCase());
}

export { buildClickSignature, verifyClickSignature };
export type { ClickSignatureInput };
