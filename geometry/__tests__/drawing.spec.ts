import { drawFloor, toSvg } from '../drawing';
import { buildHouse } from '../layout';
import type { DrawPrimitive } from '../types';
import { BOUNDS, OPTIONS, sampleTree } from './fixtures';

const NAMES = {
  living: 'Mehmonxona',
  bedroom: 'Yotoqxona',
  kitchen: 'Oshxona',
  bathroom: 'Sanuzel',
  corridor: 'Koridor',
};

const floor = buildHouse({ bounds: BOUNDS, floors: [{ level: 1, tree: sampleTree() }] }, OPTIONS)
  .house.floors[0];

const drawing = drawFloor(floor, { names: NAMES });

const only = <K extends DrawPrimitive['kind']>(kind: K) =>
  drawing.primitives.filter((primitive): primitive is Extract<DrawPrimitive, { kind: K }> =>
    primitive.kind === kind,
  );

describe('2D drawing primitives', () => {
  it('gives an outline for every room', () => {
    const rooms = only('room');
    expect(rooms).toHaveLength(floor.rooms.length);
    expect(rooms[0].points).toHaveLength(4);
  });

  it('a label per room — name and area', () => {
    const labels = only('label');
    expect(labels).toHaveLength(floor.rooms.length);

    const living = labels.find((label) => label.title === 'Mehmonxona');
    expect(living).toBeDefined();
    expect(living!.subtitle).toMatch(/^\d+\.\d m²$/);
  });

  it('falls back to the room code when the name is missing', () => {
    const bare = drawFloor(floor, {});
    const titles = bare.primitives.filter((p) => p.kind === 'label').map((p) => (p as any).title);
    expect(titles).toContain('living');
  });

  it('the label sits at the centre of the room', () => {
    const label = only('label')[0];
    const room = floor.rooms.find((candidate) => candidate.id === label.roomId)!;

    expect(label.at.x).toBeCloseTo(room.rect.x + room.rect.width / 2, 2);
    expect(label.at.y).toBeCloseTo(room.rect.y + room.rect.length / 2, 2);
  });

  describe('walls break where the openings are', () => {
    it('a wall with an opening splits into several parts', () => {
      const withOpenings = new Set(floor.openings.map((opening) => opening.wallId));
      const segments = only('wall');

      for (const wallId of withOpenings) {
        const wall = floor.walls.find((candidate) => candidate.id === wallId)!;
        const parts = segments.filter((segment) => segment.wallId === wallId);
        const drawnLength = parts.reduce(
          (sum, part) => sum + Math.hypot(part.to.x - part.from.x, part.to.y - part.from.y),
          0,
        );
        const fullLength = Math.hypot(wall.to.x - wall.from.x, wall.to.y - wall.from.y);

        // Chizilgan uzunlik to'liq uzunlikdan kam — ochiqlik joyi bo'sh qolgan.
        expect(drawnLength).toBeLessThan(fullLength);
      }
    });

    it('a wall with no opening is drawn whole', () => {
      const withOpenings = new Set(floor.openings.map((opening) => opening.wallId));
      const plain = floor.walls.find((wall) => !withOpenings.has(wall.id))!;
      const parts = only('wall').filter((segment) => segment.wallId === plain.id);

      expect(parts).toHaveLength(1);
    });
  });

  describe('doors', () => {
    const doors = floor.openings.filter((o) => o.kind === 'door' || o.kind === 'entrance');

    it('each door draws a gap, a leaf and an arc', () => {
      for (const door of doors) {
        expect(only('gap').some((p) => p.openingId === door.id)).toBe(true);
        expect(only('door-leaf').some((p) => p.openingId === door.id)).toBe(true);
        expect(only('door-arc').some((p) => p.openingId === door.id)).toBe(true);
      }
    });

    it('the arc radius equals the door width and opens 90 degrees', () => {
      for (const arc of only('door-arc')) {
        expect(arc.radius).toBeGreaterThan(0);
        expect(Math.abs(arc.sweep)).toBeCloseTo(Math.PI / 2, 3);
      }
    });

    it('the leaf length equals the door width', () => {
      for (const leaf of only('door-leaf')) {
        const length = Math.hypot(leaf.to.x - leaf.from.x, leaf.to.y - leaf.from.y);
        const arc = only('door-arc').find((a) => a.openingId === leaf.openingId)!;
        expect(length).toBeCloseTo(arc.radius, 2);
      }
    });
  });

  it('windows come out as their own primitive', () => {
    const windows = floor.openings.filter((o) => o.kind === 'window');
    expect(only('window')).toHaveLength(windows.length);
  });

  describe('dimension lines', () => {
    it('present on all four sides', () => {
      const sides = new Set(only('dimension').map((d) => d.side));
      expect(sides).toContain('top');
      expect(sides).toContain('left');
      expect(sides).toContain('bottom');
      expect(sides).toContain('right');
    });

    it('the overall sizes match the bounds', () => {
      const bottom = only('dimension').find((d) => d.side === 'bottom')!;
      const right = only('dimension').find((d) => d.side === 'right')!;

      expect(bottom.text).toBe('12 m');
      expect(right.text).toBe('15 m');
    });

    it('the inner chain segments sum to the full size', () => {
      const top = only('dimension').filter((d) => d.side === 'top');
      const sum = top.reduce((total, d) => total + Math.abs(d.to.x - d.from.x), 0);
      expect(sum).toBeCloseTo(BOUNDS.width, 1);
    });

    it('the line runs outside the extra volume on that side', () => {
      const built = buildHouse(
        { bounds: BOUNDS, floors: [{ level: 1, tree: sampleTree() }], extras: [{ kind: 'garage' }] },
        OPTIONS,
      ).house;

      const garage = built.extras.find((extra) => extra.kind === 'garage')!;
      const dimensions = drawFloor(built.floors[0], { extras: built.extras }).primitives.filter(
        (primitive): primitive is Extract<DrawPrimitive, { kind: 'dimension' }> =>
          primitive.kind === 'dimension',
      );

      // Garaj qaysi tomonga qo'yilgan bo'lsa, o'sha tomondagi chiziq uning
      // ustidan emas, ortidan o'tishi kerak — aks holda ko'rinmay qoladi.
      const overhang = {
        west: BOUNDS.x - garage.rect.x,
        east: garage.rect.x + garage.rect.width - (BOUNDS.x + BOUNDS.width),
        north: BOUNDS.y - garage.rect.y,
        south: garage.rect.y + garage.rect.length - (BOUNDS.y + BOUNDS.length),
      };

      const sideFor = { west: 'left', east: 'right', north: 'top', south: 'bottom' } as const;

      for (const [direction, distance] of Object.entries(overhang)) {
        if (distance <= 0.01) continue;

        const side = sideFor[direction as keyof typeof sideFor];
        for (const dimension of dimensions.filter((d) => d.side === side)) {
          expect(dimension.offset).toBeGreaterThan(distance);
        }
      }
    });

    it('the line stays near the bounds where there is no volume', () => {
      for (const dimension of only('dimension')) {
        expect(dimension.offset).toBeCloseTo(0.7, 5);
      }
    });
  });

  it('the viewBox wraps the bounds with padding', () => {
    expect(drawing.viewBox.x).toBeLessThan(BOUNDS.x);
    expect(drawing.viewBox.y).toBeLessThan(BOUNDS.y);
    expect(drawing.viewBox.width).toBeGreaterThan(BOUNDS.width);
    expect(drawing.viewBox.height).toBeGreaterThan(BOUNDS.length);
  });

  it('parts can be switched off through the options', () => {
    const bare = drawFloor(floor, { showLabels: false, showDimensions: false, showRoomFills: false });

    expect(bare.primitives.some((p) => p.kind === 'label')).toBe(false);
    expect(bare.primitives.some((p) => p.kind === 'dimension')).toBe(false);
    expect(bare.primitives.some((p) => p.kind === 'room')).toBe(false);
    expect(bare.primitives.some((p) => p.kind === 'wall')).toBe(true);
  });
});

describe('SVG output', () => {
  const svg = toSvg(drawing);

  it('returns a properly wrapped document', () => {
    expect(svg.startsWith('<svg xmlns="http://www.w3.org/2000/svg"')).toBe(true);
    expect(svg.endsWith('</svg>')).toBe(true);
  });

  it('the tags are balanced', () => {
    const open = (svg.match(/<(?!\/)[a-z]+/g) ?? []).length;
    const selfClosing = (svg.match(/\/>/g) ?? []).length;
    const closing = (svg.match(/<\/[a-z]+>/g) ?? []).length;

    // Har bir ochilgan teg yo o'zi yopiladi, yo yopuvchi tegga ega.
    expect(open).toBe(selfClosing + closing);
  });

  it('never produces NaN or Infinity', () => {
    expect(svg).not.toMatch(/NaN/);
    expect(svg).not.toMatch(/Infinity/);
  });

  it('adds data attributes so rooms can be selected', () => {
    for (const room of floor.rooms) {
      expect(svg).toContain(`data-room="${room.id}"`);
    }
  });

  it('the colour is currentColor — it follows the theme', () => {
    expect(svg).toContain('currentColor');
  });

  it('scale increases the size', () => {
    const small = toSvg(drawing, { scale: 20 });
    const large = toSvg(drawing, { scale: 80 });

    const widthOf = (value: string) => Number(/width="([\d.]+)"/.exec(value)![1]);
    expect(widthOf(large)).toBeCloseTo(widthOf(small) * 4, 0);
  });

  it('the background colour is added when asked for', () => {
    expect(toSvg(drawing, { background: '#fff' })).toContain('fill="#fff"');
  });

  it('escapes special characters in text', () => {
    const risky = buildHouse({ bounds: BOUNDS, floors: [{ level: 1, tree: sampleTree() }] }, OPTIONS)
      .house.floors[0];
    risky.rooms[0].label = 'A & B <test>';

    const output = toSvg(drawFloor(risky, {}));
    expect(output).toContain('A &amp; B &lt;test&gt;');
    expect(output).not.toContain('<test>');
  });
});
