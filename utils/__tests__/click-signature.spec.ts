import { buildClickSignature, verifyClickSignature } from '../click-signature';
import type { ClickSignatureInput } from '../click-signature';

/**
 * Click webhookining imzo tekshiruvi.
 *
 * Bu funksiya `click.service.ts` orqali `@tsed/di` ni tortadi — jest u
 * modulni parse qila olmaydi. Shu sabab formula bu yerga, dekoratorsiz
 * faylga chiqarilgan.
 */

const SECRET = 'sinov-maxfiy-kalit';

const prepare: ClickSignatureInput = {
  clickTransId: '12345',
  serviceId: '1',
  merchantTransId: 'sub_1',
  amount: 199000,
  action: 0,
  signTime: '2026-01-01 00:00:00',
};

describe('buildClickSignature', () => {
  it('is deterministic for the same input', () => {
    expect(buildClickSignature(prepare, SECRET)).toBe(buildClickSignature({ ...prepare }, SECRET));
  });

  it('changes when the secret changes', () => {
    expect(buildClickSignature(prepare, SECRET)).not.toBe(buildClickSignature(prepare, 'boshqa-kalit'));
  });

  it('changes when any signed field changes', () => {
    const base = buildClickSignature(prepare, SECRET);

    expect(buildClickSignature({ ...prepare, amount: prepare.amount + 1 }, SECRET)).not.toBe(base);
    expect(buildClickSignature({ ...prepare, clickTransId: 'boshqa' }, SECRET)).not.toBe(base);
    expect(buildClickSignature({ ...prepare, signTime: '2026-01-01 00:00:01' }, SECRET)).not.toBe(base);
  });

  it('folds merchant_prepare_id into the hash only for action=1 (complete)', () => {
    const complete: ClickSignatureInput = { ...prepare, action: 1, merchantPrepareId: 'p1' };

    expect(buildClickSignature(complete, SECRET)).not.toBe(
      buildClickSignature({ ...complete, merchantPrepareId: 'p2' }, SECRET),
    );

    // `merchantPrepareId` faqat action=1 uchun ishlatiladi — action=0 da
    // bo'lsa ham hisobga olinmasin.
    expect(buildClickSignature(prepare, SECRET)).toBe(
      buildClickSignature({ ...prepare, merchantPrepareId: 'e\'tiborsiz' }, SECRET),
    );
  });
});

describe('verifyClickSignature', () => {
  it('accepts a signature built with the matching secret', () => {
    const signature = buildClickSignature(prepare, SECRET);

    expect(verifyClickSignature(prepare, SECRET, signature)).toBe(true);
  });

  it('is case-insensitive (Click sends lowercase hex, but is not guaranteed to)', () => {
    const signature = buildClickSignature(prepare, SECRET).toUpperCase();

    expect(verifyClickSignature(prepare, SECRET, signature)).toBe(true);
  });

  it('rejects a signature built with the wrong secret', () => {
    const signature = buildClickSignature(prepare, 'yomon-kalit');

    expect(verifyClickSignature(prepare, SECRET, signature)).toBe(false);
  });

  it('rejects a signature for a tampered field (e.g. amount changed after signing)', () => {
    const signature = buildClickSignature(prepare, SECRET);
    const tampered = { ...prepare, amount: 1 };

    expect(verifyClickSignature(tampered, SECRET, signature)).toBe(false);
  });

  it('never accepts when the provider secret is not configured', () => {
    const signature = buildClickSignature(prepare, '');

    expect(verifyClickSignature(prepare, '', signature)).toBe(false);
  });
});
