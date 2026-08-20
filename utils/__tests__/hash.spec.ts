import { exportHashOf, hashOf } from '../hash';

/**
 * Eksport keshi.
 *
 * Bu testlarning maqsadi bitta: kalit narx bilan bog'liq har qanday
 * o'zgarishda o'zgarsin. Aks holda foydalanuvchi materialni almashtirib,
 * PDF yuklab oladi va u yerda eski summani ko'radi — hech qanday
 * xatolik chiqmaydi, shunchaki noto'g'ri hujjat.
 */

const project = {
  geometry: { bounds: { x: 0, y: 0, w: 12, h: 10 } },
  estimateTotal: '482000000',
  estimateSelection: null as unknown,
};

describe('export cache key', () => {
  it('the same for the same project', () => {
    expect(exportHashOf(project)).toBe(exportHashOf({ ...project }));
  });

  it('changes when the geometry changes', () => {
    const moved = { ...project, geometry: { bounds: { x: 0, y: 0, w: 12, h: 11 } } };

    expect(exportHashOf(moved)).not.toBe(exportHashOf(project));
  });

  it('changes when the total changes', () => {
    // Aynan shu holat ilgari ushlanmasdi: narx bazasi yangilangan,
    // geometriya o'sha-o'sha, va foydalanuvchi eski PDF'ni olardi.
    const repriced = { ...project, estimateTotal: '501000000' };

    expect(exportHashOf(repriced)).not.toBe(exportHashOf(project));
  });

  it('changes when the material changes, even at the same total', () => {
    // Ikki material bir xil narxda bo'lishi mumkin — summa o'zgarmaydi,
    // lekin hujjatdagi material nomi boshqa bo'ladi.
    const chosen = { ...project, estimateSelection: { wall_exterior: { optionCode: 'gisht' } } };

    expect(exportHashOf(chosen)).not.toBe(exportHashOf(project));
  });

  it('an empty selection equals no selection', () => {
    // `selectionOrNull` bo'sh obyektni `null` qilib yozadi, ya'ni bu
    // ikkisi bazada hech qachon ajralmaydi.
    expect(exportHashOf({ ...project, estimateSelection: null })).toBe(exportHashOf(project));
  });

  it('a Decimal object hashes like a string', () => {
    // Prisma `Decimal` qaytaradi, `JSON.stringify` esa uni obyekt deb
    // ko'radi — ichki maydonlari kutubxona versiyasiga bog'liq.
    const decimalLike = { toString: () => '482000000' };

    expect(exportHashOf({ ...project, estimateTotal: decimalLike })).toBe(exportHashOf(project));
  });
});

describe('hashOf', () => {
  it('sensitive to key order', () => {
    // Bu cheklov: JSON tartibi muhim, ya'ni bir xil ma'noli lekin
    // boshqacha tartibdagi obyekt keshni behuda yangilaydi. Zarar yo'q
    // (ortiqcha bir marta yaratiladi), lekin bilib turish kerak.
    expect(hashOf({ a: 1, b: 2 })).not.toBe(hashOf({ b: 2, a: 1 }));
  });

  it('always returns a hex string', () => {
    expect(hashOf(null)).toMatch(/^[0-9a-f]+$/);
    expect(hashOf({ deep: [1, 2, { x: 'y' }] })).toMatch(/^[0-9a-f]+$/);
  });
});
