import { buildRoof, eaveHeightFor, polygonArea3 } from '../roof';
import type { Rect, RoofType } from '../types';

const BOUNDS: Rect = { x: 0, y: 0, width: 12, length: 15 };
const EAVE = 3;

const build = (type: RoofType, pitch = 30, overhang = 0) =>
  buildRoof({ bounds: BOUNDS, spec: { type, pitch, overhang }, eaveHeight: EAVE });

const rad = (degrees: number) => (degrees * Math.PI) / 180;

/**
 * Qiya tom yuzasi tekis proyeksiyasidan aynan `1 / cos(burchak)` marta katta.
 * Bu to'rt tom turi uchun ham amal qiladi va hisobning to'g'riligini
 * tekshiradigan eng kuchli invariant.
 */
const expectedArea = (rect: Rect, pitch: number) => (rect.width * rect.length) / Math.cos(rad(pitch));

describe('roof geometry', () => {
  describe('overhang', () => {
    it('widens the outline on every side', () => {
      const roof = build('gable', 30, 0.5);
      expect(roof.eaveRect).toEqual({ x: -0.5, y: -0.5, width: 13, length: 16 });
    });

    it('increases the area', () => {
      const without = build('gable', 30, 0);
      const with50 = build('gable', 30, 0.5);
      expect(with50.totalArea).toBeGreaterThan(without.totalArea);
    });
  });

  describe('flat roof', () => {
    const roof = build('flat');

    it('one plane and no gables', () => {
      expect(roof.planes).toHaveLength(1);
      expect(roof.gables).toHaveLength(0);
    });

    it('has a slight pitch so water runs off', () => {
      expect(roof.ridgeRise).toBeGreaterThan(0);
      expect(roof.ridgeRise).toBeLessThan(1);
      expect(roof.planes[0].slope).toBeCloseTo(2, 0);
    });

    it('the area is nearly equal to the outline', () => {
      expect(roof.totalArea).toBeCloseTo(BOUNDS.width * BOUNDS.length, 0);
    });
  });

  describe('shed roof', () => {
    const roof = build('shed', 20);

    it('a single sloped plane', () => {
      expect(roof.planes).toHaveLength(1);
      expect(roof.planes[0].slope).toBeCloseTo(20, 1);
    });

    it('the area follows the 1/cos(angle) rule', () => {
      expect(roof.totalArea).toBeCloseTo(expectedArea(roof.eaveRect, 20), 1);
    });
  });

  describe('gable roof', () => {
    const roof = build('gable', 30);

    it('two sloped planes and two gables', () => {
      expect(roof.planes).toHaveLength(2);
      expect(roof.gables).toHaveLength(2);
    });

    it('both planes share the same pitch', () => {
      expect(roof.planes[0].slope).toBeCloseTo(30, 1);
      expect(roof.planes[1].slope).toBeCloseTo(30, 1);
    });

    it('the ridge runs along the longer side', () => {
      // 12 × 15 → uzun tomon `y`, demak tepa `y` bo'ylab.
      const { from, to } = roof.ridge!;
      expect(from.x).toBeCloseTo(to.x, 5);
      expect(Math.abs(to.y - from.y)).toBeCloseTo(BOUNDS.length, 5);
    });

    it('the ridge direction flips on a wider house', () => {
      const wide = buildRoof({
        bounds: { x: 0, y: 0, width: 20, length: 10 },
        spec: { type: 'gable', pitch: 30, overhang: 0 },
        eaveHeight: EAVE,
      });

      const { from, to } = wide.ridge!;
      expect(from.y).toBeCloseTo(to.y, 5);
      expect(Math.abs(to.x - from.x)).toBeCloseTo(20, 5);
    });

    it('the area follows the 1/cos(angle) rule', () => {
      expect(roof.totalArea).toBeCloseTo(expectedArea(roof.eaveRect, 30), 1);
    });

    it('the ridge height is half the span × tan(angle)', () => {
      // Qisqa tomon 12 → yarim ochiqlik 6.
      expect(roof.ridgeRise).toBeCloseTo(6 * Math.tan(rad(30)), 1);
    });

    it('the gables are triangles', () => {
      expect(roof.gables[0].vertices).toHaveLength(3);
      expect(roof.gables[1].vertices).toHaveLength(3);
    });
  });

  describe('hip roof', () => {
    const roof = build('hip', 30);

    it('four planes, no gables', () => {
      expect(roof.planes).toHaveLength(4);
      expect(roof.gables).toHaveLength(0);
    });

    it('all four sides share the same pitch', () => {
      for (const plane of roof.planes) {
        expect(plane.slope).toBeCloseTo(30, 1);
      }
    });

    it('the ridge is shorter than the building', () => {
      const { from, to } = roof.ridge!;
      const ridgeLength = Math.hypot(to.x - from.x, to.y - from.y);
      expect(ridgeLength).toBeCloseTo(BOUNDS.length - BOUNDS.width, 1);
      expect(ridgeLength).toBeLessThan(BOUNDS.length);
    });

    it('the area matches a gable roof — a geometric fact', () => {
      expect(roof.totalArea).toBeCloseTo(expectedArea(roof.eaveRect, 30), 1);
      expect(roof.totalArea).toBeCloseTo(build('gable', 30).totalArea, 1);
    });

    it('becomes a pyramid on a square house', () => {
      const pyramid = buildRoof({
        bounds: { x: 0, y: 0, width: 12, length: 12 },
        spec: { type: 'hip', pitch: 30, overhang: 0 },
        eaveHeight: EAVE,
      });

      const { from, to } = pyramid.ridge!;
      expect(Math.hypot(to.x - from.x, to.y - from.y)).toBeCloseTo(0, 5);
    });
  });

  describe('pitch angle', () => {
    it('at 0 degrees the area equals the outline', () => {
      const roof = build('gable', 0);
      expect(roof.totalArea).toBeCloseTo(BOUNDS.width * BOUNDS.length, 1);
      expect(roof.ridgeRise).toBeCloseTo(0, 5);
    });

    it('the area grows monotonically with the angle', () => {
      const areas = [0, 10, 20, 30, 40, 50].map((pitch) => build('gable', pitch).totalArea);

      for (let i = 1; i < areas.length; i++) {
        expect(areas[i]).toBeGreaterThan(areas[i - 1]);
      }
    });

    it('above 60 degrees is clamped', () => {
      expect(build('gable', 85).totalArea).toBeCloseTo(build('gable', 60).totalArea, 5);
    });
  });

  describe('polygon area', () => {
    it('computes a horizontal square correctly', () => {
      const area = polygonArea3([
        { x: 0, y: 0, z: 0 },
        { x: 4, y: 0, z: 0 },
        { x: 4, y: 3, z: 0 },
        { x: 0, y: 3, z: 0 },
      ]);
      expect(area).toBeCloseTo(12, 6);
    });

    it('computes a sloped rectangle correctly', () => {
      // 3-4-5 uchburchak: gorizontal 4, vertikal 3 → qiya 5.
      const area = polygonArea3([
        { x: 0, y: 0, z: 0 },
        { x: 10, y: 0, z: 0 },
        { x: 10, y: 4, z: 3 },
        { x: 0, y: 4, z: 3 },
      ]);
      expect(area).toBeCloseTo(50, 6);
    });
  });

  describe('wall top height', () => {
    it('one floor — ceiling height', () => {
      expect(eaveHeightFor(1, 2.8)).toBeCloseTo(2.8, 5);
    });

    it('two floors — the slab thickness is added too', () => {
      expect(eaveHeightFor(2, 2.8, 0.25)).toBeCloseTo(5.85, 5);
    });
  });

  it('the numbers hold for every roof type', () => {
    for (const type of ['flat', 'shed', 'gable', 'hip'] as RoofType[]) {
      const roof = build(type, 35, 0.6);

      expect(Number.isFinite(roof.totalArea)).toBe(true);
      expect(roof.totalArea).toBeGreaterThan(0);

      for (const plane of [...roof.planes, ...roof.gables]) {
        expect(plane.vertices.length).toBeGreaterThanOrEqual(3);
        for (const vertex of plane.vertices) {
          expect(Number.isFinite(vertex.x)).toBe(true);
          expect(Number.isFinite(vertex.y)).toBe(true);
          expect(Number.isFinite(vertex.z)).toBe(true);
          expect(vertex.z).toBeGreaterThanOrEqual(EAVE - 1e-6);
        }
      }
    }
  });
});

describe('pyramid roof', () => {
  const roof = build('pyramid', 30);

  it('four triangles, no gables', () => {
    expect(roof.planes).toHaveLength(4);
    expect(roof.gables).toHaveLength(0);
    for (const plane of roof.planes) {
      expect(plane.vertices).toHaveLength(3);
    }
  });

  it('a plain rectangular house still gets an apex point', () => {
    // Aynan shu narsa `hipRoof` dan farq qiladi: u bu konturda tepa
    // CHIZIG'I qoldiradi, piramida esa har doim nuqtada uchrashadi.
    const { from, to } = roof.ridge!;

    expect(Math.hypot(to.x - from.x, to.y - from.y)).toBeCloseTo(0, 5);
  });

  it('the apex sits exactly at the centre of the outline', () => {
    const { from } = roof.ridge!;

    expect(from.x).toBeCloseTo(BOUNDS.x + BOUNDS.width / 2, 5);
    expect(from.y).toBeCloseTo(BOUNDS.y + BOUNDS.length / 2, 5);
  });

  it('the height comes from the shorter side', () => {
    // Uzun tomondan hisoblansa tom haddan tashqari baland bo'lardi.
    const half = Math.min(BOUNDS.width, BOUNDS.length) / 2;

    expect(roof.ridgeRise).toBeCloseTo(half * Math.tan(rad(30)), 1);
  });

  it('every triangle touches the apex', () => {
    const apex = roof.ridge!.from;

    for (const plane of roof.planes) {
      const touches = plane.vertices.some(
        (vertex) =>
          Math.abs(vertex.x - apex.x) < 0.01 &&
          Math.abs(vertex.y - apex.y) < 0.01 &&
          Math.abs(vertex.z - apex.z) < 0.01,
      );
      expect(touches).toBe(true);
    }
  });

  it('the area exceeds the flat projection', () => {
    // Piramidada har bir uchburchakning qiyaligi turlicha (uzun va
    // qisqa tomonlar), shuning uchun `1 / cos` invarianti amal
    // qilmaydi — lekin yuza konturdan katta bo'lishi shart.
    const flat = roof.eaveRect.width * roof.eaveRect.length;

    expect(roof.totalArea).toBeGreaterThan(flat);
    expect(roof.totalArea).toBeLessThan(flat / Math.cos(rad(30)) + 1);
  });

  it('identical to a hip roof on a square house', () => {
    const square: Rect = { x: 0, y: 0, width: 12, length: 12 };
    const asPyramid = buildRoof({
      bounds: square,
      spec: { type: 'pyramid', pitch: 30, overhang: 0 },
      eaveHeight: EAVE,
    });
    const asHip = buildRoof({
      bounds: square,
      spec: { type: 'hip', pitch: 30, overhang: 0 },
      eaveHeight: EAVE,
    });

    expect(asPyramid.totalArea).toBeCloseTo(asHip.totalArea, 1);
  });
});

describe('mansard roof', () => {
  const roof = buildRoof({
    bounds: BOUNDS,
    spec: { type: 'mansard', pitch: 60, overhang: 0, upperPitch: 20, breakRatio: 0.5 },
    eaveHeight: EAVE,
  });

  it('eight planes: a lower and an upper ring', () => {
    expect(roof.planes).toHaveLength(8);
    expect(roof.gables).toHaveLength(0);
  });

  it('the lower ring is steep, the upper one shallow', () => {
    const lower = roof.planes.filter((plane) => plane.id.startsWith('l'));
    const upper = roof.planes.filter((plane) => plane.id.startsWith('u'));

    expect(lower).toHaveLength(4);
    expect(upper).toHaveLength(4);

    for (const plane of lower) expect(plane.slope).toBeCloseTo(60, 0);
    for (const plane of upper) expect(plane.slope).toBeCloseTo(20, 0);
  });

  it('the point of a mansard: taller than a hip roof', () => {
    // Pastki tik qism tom ostidagi bo'y balandligini beradi — aynan
    // shu narsa uchun mansard tanlanadi.
    const hip = build('hip', 20);

    expect(roof.ridgeRise).toBeGreaterThan(hip.ridgeRise);
  });

  it('the area exceeds a hip roof', () => {
    expect(roof.totalArea).toBeGreaterThan(build('hip', 20).totalArea);
  });

  it('the upper pitch never exceeds the lower one', () => {
    // Admin xato kiritsa (yuqorisi tikroq) tom "sinmay" qolardi va
    // yuqori tekislik pastkisining ustiga chiqib ketishi mumkin edi.
    const wrong = buildRoof({
      bounds: BOUNDS,
      spec: { type: 'mansard', pitch: 30, overhang: 0, upperPitch: 50 },
      eaveHeight: EAVE,
    });

    const lower = wrong.planes.find((plane) => plane.id === 'l1')!;
    const upper = wrong.planes.find((plane) => plane.id === 'u1')!;

    expect(upper.slope).toBeLessThan(lower.slope);
  });

  it('the break share changes the roof height', () => {
    const low = buildRoof({
      bounds: BOUNDS,
      spec: { type: 'mansard', pitch: 60, overhang: 0, upperPitch: 20, breakRatio: 0.25 },
      eaveHeight: EAVE,
    });
    const high = buildRoof({
      bounds: BOUNDS,
      spec: { type: 'mansard', pitch: 60, overhang: 0, upperPitch: 20, breakRatio: 0.75 },
      eaveHeight: EAVE,
    });

    // Sinish balandroq bo'lsa tik qism uzunroq — ya'ni tom balandroq.
    expect(high.ridgeRise).toBeGreaterThan(low.ridgeRise);
  });

  it('a share outside the range is still safe', () => {
    for (const breakRatio of [-1, 0, 1, 5]) {
      const built = buildRoof({
        bounds: BOUNDS,
        spec: { type: 'mansard', pitch: 60, overhang: 0, upperPitch: 20, breakRatio },
        eaveHeight: EAVE,
      });

      expect(built.planes).toHaveLength(8);
      expect(built.totalArea).toBeGreaterThan(0);
      expect(Number.isFinite(built.ridgeRise)).toBe(true);
    }
  });

  it('the upper pitch is chosen when none is given', () => {
    const auto = buildRoof({
      bounds: BOUNDS,
      spec: { type: 'mansard', pitch: 50, overhang: 0 },
      eaveHeight: EAVE,
    });

    expect(auto.planes).toHaveLength(8);
    expect(auto.planes.find((plane) => plane.id === 'u1')!.slope).toBeLessThan(50);
  });
});
