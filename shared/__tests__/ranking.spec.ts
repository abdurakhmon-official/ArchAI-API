import { rankCandidates, relaxedCandidates, type SkeletonRow } from '../generate';

/**
 * Andozalar tartibi.
 *
 * Ilgari saralash faqat `fit` bo'yicha edi. Ko'pchilik andoza bir xil
 * moslik oladi (100), ya'ni ularning o'zaro tartibi bazadan kelgan
 * tartibga tayanib qolardi. Bir xil so'rov turli uy berishi mumkin
 * edi — va bu generator "beqaror" degan taassurot tug'diradi.
 *
 * Bu testlar aynan TENGLIK holatini tekshiradi: bir xil moslikdagi
 * andozalar har doim bir xil tartibda chiqishi kerak, kirish tartibi
 * qanday bo'lishidan qat'i nazar.
 */

/** Bitta bargli daraxt — mazmuni bu yerda ahamiyatsiz. */
const tree = { floors: [{ level: 1, tree: { kind: 'leaf', id: 'r1', roomType: 'living' } }] };

function row(id: string, name: string, extra: Partial<SkeletonRow> = {}): SkeletonRow {
  return {
    id,
    name,
    floors: 1,
    minWidth: 6,
    maxWidth: 20,
    minLength: 6,
    maxLength: 20,
    tagBedrooms: [],
    tagStyles: [],
    tree,
    ...extra,
  } as SkeletonRow;
}

const QUERY = { floors: 1, bedrooms: 2, width: 12, length: 10 };

describe('skeleton ordering', () => {
  it('descends by fit', () => {
    const ranked = rankCandidates(
      [
        row('a', 'A', { tagBedrooms: [5] }),
        row('b', 'B', { tagBedrooms: [2] }),
      ],
      QUERY,
    );

    expect(ranked.map((item) => item.id)).toEqual(['b', 'a']);
  });

  it('sorts by name on an equal fit', () => {
    const ranked = rankCandidates([row('x', 'Zamonaviy'), row('y', 'Ixcham')], QUERY);

    expect(ranked.map((item) => item.name)).toEqual(['Ixcham', 'Zamonaviy']);
  });

  it('input order does not affect the result', () => {
    /*
      Aynan shu buzilgan edi. Ikkala ro'yxat bir xil andozalarni
      boshqa tartibda beradi — natija esa bir xil bo'lishi shart.
    */
    const rows = [row('a', 'Bir'), row('b', 'Ikki'), row('c', 'Uch')];

    const forward = rankCandidates(rows, QUERY).map((item) => item.id);
    const backward = rankCandidates([...rows].reverse(), QUERY).map((item) => item.id);

    expect(backward).toEqual(forward);
  });

  it('the identifier decides when the names tie too', () => {
    // Andoza nomi bazada noyob emas — admin ikkitasini bir xil
    // nomlashi mumkin, va shunda tartib butunlay aniqsiz qolardi.
    const rows = [row('zzz', 'Bir xil'), row('aaa', 'Bir xil')];

    const forward = rankCandidates(rows, QUERY).map((item) => item.id);
    const backward = rankCandidates([...rows].reverse(), QUERY).map((item) => item.id);

    expect(forward).toEqual(['aaa', 'zzz']);
    expect(backward).toEqual(forward);
  });

  it('the fallback list is stable too', () => {
    // `relaxedCandidates` umuman saralanmasdi.
    const rows = [row('c', 'Uch'), row('a', 'Bir'), row('b', 'Ikki')];

    const forward = relaxedCandidates(rows, QUERY).map((item) => item.id);
    const backward = relaxedCandidates([...rows].reverse(), QUERY).map((item) => item.id);

    expect(forward).toEqual(['a', 'b', 'c']);
    expect(backward).toEqual(forward);
  });
});
