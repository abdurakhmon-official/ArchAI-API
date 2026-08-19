import {
  DEFAULT_PALETTE,
  FLOOR_FINISHES,
  floorSpecFor,
  paletteFrom,
  type StyleAppearance,
} from '../palette';
import type { MeshMaterial } from '../../geometry/types';

/**
 * Uslub ranglari.
 *
 * Bu testlarning maqsadi bitta: turli uslub turli ko'rinish bersin.
 * Ilgari ranglar `house-3d.tsx` da qattiq yozilgandi va bazadagi
 * qiymatlar 3D ga umuman yetmasdi — to'rtala uslub bir xil ko'rinardi.
 * Buni hech qanday test ushlamasdi, chunki hech kim tekshirmagan edi.
 */

const modern: StyleAppearance = {
  facade: { primary: '#EDEAE5', accent: '#3A3A3C', plinth: '#2B2B2D' },
  interior: {
    wallColor: '#F5F3F0',
    skirting: '#FFFFFF',
    floorByRoomType: { living: 'laminate', bathroom: 'tile' },
  },
  window: { frameColor: '#2B2B2D' },
  roofColor: '#3A3A3C',
};

const classic: StyleAppearance = {
  facade: { primary: '#F7F2E8', accent: '#8B6F47' },
  interior: { wallColor: '#FDF8F0', floorByRoomType: { living: 'parquet' } },
  roofColor: '#8B3A2E',
};

describe('from a style to a palette', () => {
  it('the facade colour lands on the exterior wall', () => {
    expect(paletteFrom(modern)['wall-exterior'].color).toBe('#EDEAE5');
    expect(paletteFrom(classic)['wall-exterior'].color).toBe('#F7F2E8');
  });

  it('the interior colour lands on the inner wall', () => {
    expect(paletteFrom(modern)['wall-interior'].color).toBe('#F5F3F0');
    expect(paletteFrom(classic)['wall-interior'].color).toBe('#FDF8F0');
  });

  it('the roof colour comes from the preset', () => {
    expect(paletteFrom(modern).roof.color).toBe('#3A3A3C');
    expect(paletteFrom(classic).roof.color).toBe('#8B3A2E');
  });

  it('two styles look different', () => {
    // Aynan shu narsa buzilgan edi. Bitta rang mos kelishi mumkin,
    // lekin butun palitra bir xil bo'lsa — uslub tanlash ma'nosiz.
    const a = paletteFrom(modern);
    const b = paletteFrom(classic);

    expect(JSON.stringify(a)).not.toBe(JSON.stringify(b));
  });

  it('falls back to the default when no style is given', () => {
    expect(paletteFrom(null)).toEqual(DEFAULT_PALETTE);
    expect(paletteFrom(undefined)).toEqual(DEFAULT_PALETTE);
  });

  it('a half-filled style still works', () => {
    // Admin yangi uslub yaratib, faqat fasadni to'ldirgan bo'lishi
    // mumkin — 3D baribir chizilishi kerak.
    const partial = paletteFrom({ facade: { primary: '#123456' } });

    expect(partial['wall-exterior'].color).toBe('#123456');
    expect(partial['wall-interior'].color).toBe(DEFAULT_PALETTE['wall-interior'].color);
    expect(partial.roof.color).toBe(DEFAULT_PALETTE.roof.color);
  });

  it('gives every material a value', () => {
    const materials: MeshMaterial[] = [
      'wall-exterior',
      'wall-interior',
      'floor',
      'ceiling',
      'roof',
      'glass',
      'door',
      'stairs',
    ];

    const palette = paletteFrom(modern);

    // Yetishmagan material `undefined` bo'lsa three.js qora chizadi.
    for (const material of materials) {
      expect(palette[material]).toBeDefined();
      expect(palette[material].color).toMatch(/^#[0-9a-fA-F]{6}$/);
    }
  });
});

describe('floor covering', () => {
  it('chosen by room type', () => {
    const palette = paletteFrom(modern);

    expect(floorSpecFor(modern, 'living', palette)).toEqual(FLOOR_FINISHES.laminate);
    expect(floorSpecFor(modern, 'bathroom', palette)).toEqual(FLOOR_FINISHES.tile);
  });

  it('an unmarked room falls back to the shared floor', () => {
    const palette = paletteFrom(modern);

    // `modern` da yotoqxona uchun qoplama yozilmagan.
    expect(floorSpecFor(modern, 'bedroom', palette)).toEqual(palette.floor);
  });

  it('an unknown cover name breaks nothing', () => {
    const broken: StyleAppearance = {
      interior: { floorByRoomType: { living: 'marmar-oltin' } },
    };
    const palette = paletteFrom(broken);

    expect(floorSpecFor(broken, 'living', palette)).toEqual(palette.floor);
  });

  it('a shared floor when no room type is given', () => {
    const palette = paletteFrom(modern);

    expect(floorSpecFor(modern, undefined, palette)).toEqual(palette.floor);
  });
});
