import { createHash, randomBytes } from 'node:crypto';
import { VERIFICATION_PURPOSE } from '../generated/prisma';
import prisma from '@/modules/db';

/**
 * Email tasdiqlash va parolni tiklash tokenlari.
 *
 * Token bazada XESHLANIB saqlanadi. Sabab oddiy: bu tokenlar parol
 * kuchiga ega — ular bilan hisobga kirish mumkin. Baza nusxasi
 * o'g'irlansa yoki zaxira fayli chiqib ketsa, xom qiymatlar bilan
 * hamma hisobni egallash mumkin bo'lardi. Xesh esa foydasiz.
 *
 * Xom qiymat faqat bir marta — xatga — chiqadi va hech qayerda
 * qolmaydi. Shu sababli "tokenni qayta ko'rish" degan imkoniyat yo'q:
 * yo'qotilsa, yangisi so'raladi.
 */

/** Parolni tiklash havolasi qancha yashaydi. */
export const RESET_TTL_MINUTES = 60;

/** Email tasdiqlash havolasi qancha yashaydi. */
export const VERIFY_TTL_HOURS = 24;

/**
 * 32 bayt — taxmin qilib bo'lmaydigan uzunlik.
 *
 * `randomBytes` kriptografik generator: `Math.random` bu yerda mutlaqo
 * yaramaydi, chunki uning ketma-ketligini oldingi qiymatlardan tiklash
 * mumkin.
 */
function generate(): string {
  return randomBytes(32).toString('base64url');
}

function hashOf(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

/**
 * Yangi token yaratadi va o'sha maqsaddagi eskilarini bekor qiladi.
 *
 * Eskilarini bekor qilish muhim: aks holda foydalanuvchi "parolni
 * unutdim" ni besh marta bosgach, beshta ishlaydigan havola qolardi va
 * ularning har biri eski pochta qutisida yotib qolishi mumkin.
 */
export async function issueToken(
  userId: string,
  purpose: VERIFICATION_PURPOSE,
): Promise<string> {
  const token = generate();
  const ttlMs =
    purpose === VERIFICATION_PURPOSE.PASSWORD_RESET
      ? RESET_TTL_MINUTES * 60_000
      : VERIFY_TTL_HOURS * 3_600_000;

  await prisma.$transaction([
    prisma.verificationToken.updateMany({
      where: { userId: userId, purpose, usedAt: null },
      data: { usedAt: new Date() },
    }),
    prisma.verificationToken.create({
      data: {
        userId: userId,
        tokenHash: hashOf(token),
        purpose,
        expiresAt: new Date(Date.now() + ttlMs),
      },
    }),
  ]);

  return token;
}

export interface ConsumedToken {
  userId: string;
}

/**
 * Tokenni ishlatadi — bir marta.
 *
 * Muvaffaqiyatli bo'lsa `usedAt` darhol to'ldiriladi, ya'ni bir xil
 * havolani ikki marta ishlatib bo'lmaydi. Bu muhim: havola brauzer
 * tarixida, pochta qutisida va ba'zan xabar oldindan ko'rish
 * xizmatlarining jurnalida qoladi.
 *
 * Yaroqsiz token uchun `null` qaytadi — sabablari (topilmadi, muddati
 * o'tdi, ishlatilgan) ATAYLAB ajratilmaydi: farqni aytish tokenni
 * taxmin qilayotgan odamga yordam berardi.
 */
export async function consumeToken(
  token: string,
  purpose: VERIFICATION_PURPOSE,
): Promise<ConsumedToken | null> {
  const record = await prisma.verificationToken.findUnique({
    where: { tokenHash: hashOf(token) },
  });

  if (!record || record.purpose !== purpose) return null;
  if (record.usedAt) return null;
  if (record.expiresAt <= new Date()) return null;

  /*
    Shartli yangilash — poyga oldini oladi.

    Ikki so'rov bir vaqtda kelsa, ikkalasi ham yuqoridagi tekshiruvdan
    o'tib ketishi mumkin. `usedAt: null` sharti bilan yangilash esa
    faqat bittasiga tegadi.
  */
  const claimed = await prisma.verificationToken.updateMany({
    where: { id: record.id, usedAt: null },
    data: { usedAt: new Date() },
  });

  if (claimed.count === 0) return null;

  return { userId: record.userId };
}

/** Muddati o'tgan va ishlatilgan tokenlarni tozalaydi. */
export async function purgeExpiredTokens(): Promise<number> {
  const result = await prisma.verificationToken.deleteMany({
    where: {
      OR: [{ expiresAt: { lt: new Date() } }, { usedAt: { not: null } }],
    },
  });

  return result.count;
}
