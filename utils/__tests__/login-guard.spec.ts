/**
 * Parol tanlashga qarshi hisob qo'riqchisi.
 *
 * Redis ATAYLAB "yo'q" deb ko'rsatiladi: aynan shu holat sinaladi.
 * `rate-limit.middleware.ts` Redis yo'qolganda chegarani ochib yuboradi,
 * ya'ni o'shanda jarayon ichidagi zaxira YAGONA himoya bo'lib qoladi.
 *
 * Mocksiz test faqat Redis tasodifan o'chiq bo'lgani uchun o'tardi —
 * kimdir uni ishga tushirsa test jimgina boshqa yo'lni sinay boshlardi.
 * Ustiga, haqiqiy modulni import qilish har testda ulanish urinishini
 * ochib, Jest jarayonini ushlab turardi.
 */
jest.mock('@/modules/redis', () => ({
  isRedisReady: () => false,
  redis: {},
}));

import {
  clearLoginFailures,
  loginBlockedFor,
  LOGIN_GUARD,
  recordLoginFailure,
} from '../login-guard';

const emailOf = (name: string) => `${name}-${Math.random().toString(36).slice(2)}@archai.uz`;

describe('login guard', () => {
  it('open at the start', async () => {
    expect(await loginBlockedFor(emailOf('fresh'))).toBe(0);
  });

  it('stays open until the limit', async () => {
    const email = emailOf('bir-nechta');

    for (let attempt = 0; attempt < LOGIN_GUARD.MAX_FAILURES - 1; attempt++) {
      await recordLoginFailure(email);
    }

    expect(await loginBlockedFor(email)).toBe(0);
  });

  it('closes after the limit', async () => {
    const email = emailOf('hujum');

    for (let attempt = 0; attempt < LOGIN_GUARD.MAX_FAILURES; attempt++) {
      await recordLoginFailure(email);
    }

    const blocked = await loginBlockedFor(email);

    expect(blocked).toBeGreaterThan(0);
    expect(blocked).toBeLessThanOrEqual(LOGIN_GUARD.WINDOW_SECONDS);
  });

  it('a correct password clears the counter', async () => {
    const email = emailOf('tiklash');

    for (let attempt = 0; attempt < LOGIN_GUARD.MAX_FAILURES; attempt++) {
      await recordLoginFailure(email);
    }
    expect(await loginBlockedFor(email)).toBeGreaterThan(0);

    await clearLoginFailures(email);

    // Haqiqiy egasi bir marta noto'g'ri yozib, keyin to'g'ri kirsa
    // keyingi safar noldan boshlashi kerak — jazolanmaydi.
    expect(await loginBlockedFor(email)).toBe(0);
  });

  it('the counts do not affect each other', async () => {
    const target = emailOf('nishon');
    const bystander = emailOf('begona');

    for (let attempt = 0; attempt < LOGIN_GUARD.MAX_FAILURES; attempt++) {
      await recordLoginFailure(target);
    }

    expect(await loginBlockedFor(target)).toBeGreaterThan(0);
    expect(await loginBlockedFor(bystander)).toBe(0);
  });

  it('case does not matter', async () => {
    const email = emailOf('Harf');

    for (let attempt = 0; attempt < LOGIN_GUARD.MAX_FAILURES; attempt++) {
      await recordLoginFailure(email.toUpperCase());
    }

    // Hujumchi harflarni almashtirib chegarani chetlab o'tolmasin.
    expect(await loginBlockedFor(email.toLowerCase())).toBeGreaterThan(0);
  });

  it('stays closed past the limit', async () => {
    const email = emailOf('davomli');

    for (let attempt = 0; attempt < LOGIN_GUARD.MAX_FAILURES * 3; attempt++) {
      await recordLoginFailure(email);
    }

    // Oyna uzaymasligi kerak, lekin yopiqlik ham yo'qolmasin.
    const blocked = await loginBlockedFor(email);
    expect(blocked).toBeGreaterThan(0);
    expect(blocked).toBeLessThanOrEqual(LOGIN_GUARD.WINDOW_SECONDS);
  });
});
