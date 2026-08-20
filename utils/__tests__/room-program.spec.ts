import {
  assertRoomProgram,
  defaultRoomProgram,
  RoomProgramError,
  type SelectableRoomType,
} from '../room-program';

/**
 * Xona buyurtmasini tekshirish.
 *
 * `RoomCountsSchema` dinamik bo'lgach, kodni tekshirish yagona joyda
 * qoldi — shu funksiya. U o'tkazib yuborgan noto'g'ri kod generatorga
 * tushadi va u yerda jimgina e'tiborsiz qoladi: foydalanuvchi so'ragan
 * xona paydo bo'lmaydi va sababi ko'rinmaydi.
 */

const type = (over: Partial<SelectableRoomType> = {}): SelectableRoomType => ({
  code: 'bedroom',
  selectable: true,
  maxCount: 8,
  defaultCount: 2,
  ...over,
});

const catalog: SelectableRoomType[] = [
  type(),
  type({ code: 'living', maxCount: 3, defaultCount: 1 }),
  type({ code: 'bathroom', maxCount: 5, defaultCount: 1 }),
  type({ code: 'office', maxCount: 3, defaultCount: 0 }),
  // Koridorni generator o'zi qo'yadi — foydalanuvchi so'ramaydi.
  type({ code: 'corridor', selectable: false, maxCount: 4, defaultCount: 0 }),
];

describe('validating the room programme', () => {
  it('lets a valid programme through', () => {
    expect(assertRoomProgram({ bedroom: 3, living: 1 }, catalog)).toEqual({
      bedroom: 3,
      living: 1,
    });
  });

  it('drops zero requests', () => {
    // Konstruktor hamma turni yuboradi, ko'pi nol bo'ladi. Ularni
    // saqlash `applyRoomProgram` da behuda aylanish beradi.
    expect(assertRoomProgram({ bedroom: 2, office: 0, living: 0 }, catalog)).toEqual({
      bedroom: 2,
    });
  });

  it('rejects an unknown code', () => {
    expect(() => assertRoomProgram({ yotoqxona: 2 }, catalog)).toThrow(RoomProgramError);
    expect(() => assertRoomProgram({ yotoqxona: 2 }, catalog)).toThrow('yotoqxona');
  });

  it('refuses a request for a service room', () => {
    // Jimgina o'tkazib yuborish mumkin edi, lekin o'shanda so'rov
    // e'tiborsiz qolgani bilinmasdi.
    expect(() => assertRoomProgram({ corridor: 1 }, catalog)).toThrow('cannot be requested');
  });

  it('applies each type its own limit', () => {
    // `living` uchun 3 ta, `bedroom` uchun 8 ta — chegara umumiy emas.
    expect(() => assertRoomProgram({ living: 4 }, catalog)).toThrow('at most 3');
    expect(assertRoomProgram({ bedroom: 8 }, catalog)).toEqual({ bedroom: 8 });
  });

  it('leaves an empty programme unchanged', () => {
    expect(assertRoomProgram({}, catalog)).toEqual({});
  });

  it('a zero request is still rejected past the limit', () => {
    // Nol emas, lekin chegaradan oshgan qiymat tozalashdan OLDIN
    // tekshirilishi kerak — aks holda 99 ta yotoqxona jimgina o'tardi.
    expect(() => assertRoomProgram({ living: 99 }, catalog)).toThrow('at most');
  });
});

describe('the default set', () => {
  it('takes only the requestable types', () => {
    expect(defaultRoomProgram(catalog)).toEqual({ bedroom: 2, living: 1, bathroom: 1 });
  });

  it('adds only the ones above zero', () => {
    // `office` sukut bo'yicha 0 — u ro'yxatga tushmasligi kerak.
    expect(defaultRoomProgram(catalog)).not.toHaveProperty('office');
  });

  it('returns empty for a catalogue with no defaults', () => {
    const bare = catalog.map((row) => ({ ...row, defaultCount: 0 }));

    expect(defaultRoomProgram(bare)).toEqual({});
  });

  it('its own result passes validation', () => {
    // Sukutlar admin qo'yadigan qiymatlar; ular o'z chegaralarini
    // buzmasligi kafolatlangan bo'lishi kerak.
    const defaults = defaultRoomProgram(catalog);

    expect(assertRoomProgram(defaults, catalog)).toEqual(defaults);
  });
});
