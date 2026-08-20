import { verifyPaymeAuth } from '../payme-auth';

/**
 * Payme Basic-auth tekshiruvi.
 *
 * `PaymeService.authorize` bu funksiyaga qayta ishlatib beradi;
 * `@tsed/di`ni tortmasligi uchun mantiq shu dekoratorsiz faylda yotadi.
 */

const SECRET = 'sinov-payme-kaliti';

const header = (login: string, key: string) =>
  `Basic ${Buffer.from(`${login}:${key}`).toString('base64')}`;

describe('verifyPaymeAuth', () => {
  it('accepts the correct Paycom login and key', () => {
    expect(verifyPaymeAuth(header('Paycom', SECRET), SECRET)).toBe(true);
  });

  it('rejects the wrong key', () => {
    expect(verifyPaymeAuth(header('Paycom', 'notogri'), SECRET)).toBe(false);
  });

  it('rejects a login other than Paycom', () => {
    expect(verifyPaymeAuth(header('BoshqaLogin', SECRET), SECRET)).toBe(false);
  });

  it('rejects a missing header', () => {
    expect(verifyPaymeAuth(undefined, SECRET)).toBe(false);
  });

  it('rejects a header that is not valid base64 Basic auth', () => {
    expect(verifyPaymeAuth('Basic yaroqsiz-tarkib', SECRET)).toBe(false);
  });

  it('never accepts when the provider secret is not configured', () => {
    expect(verifyPaymeAuth(header('Paycom', ''), '')).toBe(false);
  });
});
