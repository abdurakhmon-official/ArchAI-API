/**
 * 2D reja chizmasi.
 *
 * Ikki bosqich: avval geometriyadan ma'noli primitivlar chiqariladi
 * (devor, ochiqlik, eshik yoyi, yorliq, o'lcham chizig'i), so'ng ular
 * SVG'ga aylantiriladi.
 *
 * Ajratish sababi: brauzerda primitivlar React komponentlariga aylanadi
 * (bosiladigan xona, sudraladigan devor), serverda esa `toSvg` bilan
 * muqova va PDF uchun statik chizma chiqadi. Mantiq bir joyda qoladi.
 */

import { wallLength } from './adjacency';
import { envelope } from './extras';
import { round } from './tree';
import type {
  Drawing,
  DrawPrimitive,
  Extra,
  Floor,
  Opening,
  Point2,
  Rect,
  Room,
  Stairs,
  Wall,
} from './types';

/** O'lcham chiziqlari uchun chizma atrofidagi bo'sh joy, metrda. */
const MARGIN = 1.6;
const DIMENSION_OFFSET = 0.7;
const STEP_HEIGHT = 0.28;

/** Qo'shimcha hajmlarning ko'rinadigan nomlari. */
const EXTRA_TITLES: Record<string, string> = {
  garage: 'Garaj',
  terrace: 'Terrassa',
  balcony: 'Balkon',
  basement: 'Yerto\'la',
  sauna: 'Sauna',
  pool: 'Hovuz',
};

export interface DrawOptions {
  /** Xona turi kodidan ko'rinadigan nomga: `bedroom` → `Yotoqxona`. */
  names?: Record<string, string>;
  showDimensions?: boolean;
  showLabels?: boolean;
  showRoomFills?: boolean;
  /** Shu qavatga tegishli qo'shimcha hajmlar. */
  extras?: Extra[];
}

export function drawFloor(floor: Floor, options: DrawOptions = {}): Drawing {
  const { names = {}, showDimensions = true, showLabels = true, showRoomFills = true } = options;

  // Faqat shu qavatga tegishlilari; yerto'la (0-qavat) 1-qavat bilan chiziladi.
  const extras = (options.extras ?? []).filter(
    (extra) => extra.floor === floor.level || (extra.floor === 0 && floor.level === 1),
  );

  const primitives: DrawPrimitive[] = [];
  const openingsByWall = groupBy(floor.openings, (opening) => opening.wallId);

  for (const extra of extras) {
    primitives.push({
      kind: 'extra',
      extraId: extra.id,
      extraKind: extra.kind,
      rect: extra.rect,
      enclosed: extra.enclosed,
      title: `${EXTRA_TITLES[extra.kind] ?? extra.kind} · ${extra.area.toFixed(1)} m²`,
    });
  }

  if (showRoomFills) {
    for (const room of floor.rooms) {
      primitives.push({
        kind: 'room',
        roomId: room.id,
        roomType: room.roomType,
        points: cornersOf(room),
      });
    }
  }

  for (const wall of floor.walls) {
    const openings = openingsByWall.get(wall.id) ?? [];
    primitives.push(...drawWall(wall, openings));
    primitives.push(...drawOpenings(wall, openings, floor.rooms));
  }

  if (floor.stairs) {
    primitives.push(drawStairs(floor.stairs));
  }

  if (showLabels) {
    for (const room of floor.rooms) {
      primitives.push({
        kind: 'label',
        roomId: room.id,
        at: {
          x: round(room.rect.x + room.rect.width / 2),
          y: round(room.rect.y + room.rect.length / 2),
        },
        title: room.label ?? names[room.roomType] ?? room.roomType,
        subtitle: `${room.area.toFixed(1)} m²`,
      });
    }
  }

  // Chizma chegarasi uy va barcha hajmlarni qamrab olishi kerak — aks holda
  // garaj rasmdan tashqarida qolib ketadi.
  const outer = envelope(floor.bounds, extras);

  if (showDimensions) {
    primitives.push(...drawDimensions(floor, outer));
  }

  return {
    floor: floor.level,
    viewBox: {
      x: round(outer.x - MARGIN),
      y: round(outer.y - MARGIN),
      width: round(outer.width + MARGIN * 2),
      height: round(outer.length + MARGIN * 2),
    },
    primitives,
  };
}

// ---------------------------------------------------------------------------
//  Devorlar va ochiqliklar
// ---------------------------------------------------------------------------

/** Devor ochiqliklar joyida uziladi — qolgan bo'laklar chiziladi. */
function drawWall(wall: Wall, openings: Opening[]): DrawPrimitive[] {
  const total = wallLength(wall);
  if (total === 0) return [];

  const cuts = openings
    .map((opening) => ({
      from: Math.max(0, opening.offset - opening.width / 2),
      to: Math.min(total, opening.offset + opening.width / 2),
    }))
    .sort((a, b) => a.from - b.from);

  const segments: DrawPrimitive[] = [];
  let cursor = 0;

  for (const cut of cuts) {
    if (cut.from > cursor + 0.01) {
      segments.push(wallSegment(wall, cursor, cut.from));
    }
    cursor = Math.max(cursor, cut.to);
  }

  if (cursor < total - 0.01) {
    segments.push(wallSegment(wall, cursor, total));
  }

  return segments;
}

function wallSegment(wall: Wall, from: number, to: number): DrawPrimitive {
  return {
    kind: 'wall',
    wallId: wall.id,
    from: along(wall, from),
    to: along(wall, to),
    thickness: wall.thickness,
    exterior: wall.exterior,
  };
}

function drawOpenings(wall: Wall, openings: Opening[], rooms: Room[]): DrawPrimitive[] {
  const out: DrawPrimitive[] = [];
  const total = wallLength(wall);
  if (total === 0) return out;

  const direction = unit(wall);
  const normal = { x: -direction.y, y: direction.x };

  for (const opening of openings) {
    const start = along(wall, opening.offset - opening.width / 2);
    const end = along(wall, opening.offset + opening.width / 2);

    if (opening.kind === 'window') {
      out.push({
        kind: 'window',
        openingId: opening.id,
        from: start,
        to: end,
        thickness: wall.thickness,
      });
      continue;
    }

    // Eshik: bo'sh joy + yopiq holatdagi qanot + ochilish yoyi.
    out.push({
      kind: 'gap',
      openingId: opening.id,
      from: start,
      to: end,
      thickness: wall.thickness,
    });

    const side = swingSide(opening, wall, rooms, normal);

    out.push({
      kind: 'door-leaf',
      openingId: opening.id,
      from: start,
      to: {
        x: round(start.x + normal.x * opening.width * side),
        y: round(start.y + normal.y * opening.width * side),
      },
    });

    out.push({
      kind: 'door-arc',
      openingId: opening.id,
      hinge: start,
      radius: round(opening.width),
      startAngle: round(Math.atan2(direction.y, direction.x), 4),
      sweep: round((Math.PI / 2) * side, 4),
    });
  }

  return out;
}

/**
 * Eshik qaysi tomonga ochiladi. Ichki eshik ikkinchi xona tomonga,
 * kirish eshigi esa ichkariga — qaysi tomonda xona borligiga qarab.
 */
function swingSide(
  opening: Opening,
  wall: Wall,
  rooms: Room[],
  normal: Point2,
): 1 | -1 {
  const targetId = opening.connects?.[1] ?? wall.rooms[0];
  const target = rooms.find((room) => room.id === targetId);
  if (!target) return 1;

  const mid = along(wall, opening.offset);
  const toRoom = {
    x: target.rect.x + target.rect.width / 2 - mid.x,
    y: target.rect.y + target.rect.length / 2 - mid.y,
  };

  return toRoom.x * normal.x + toRoom.y * normal.y >= 0 ? 1 : -1;
}

function drawStairs(stairs: Stairs): DrawPrimitive {
  return {
    kind: 'stairs',
    at: { x: round(stairs.x), y: round(stairs.y) },
    width: round(stairs.width),
    length: round(stairs.length),
    steps: Math.max(3, Math.round(stairs.length / STEP_HEIGHT)),
  };
}

// ---------------------------------------------------------------------------
//  O'lcham chiziqlari
// ---------------------------------------------------------------------------

/**
 * Yuqorida — vertikal devorlar bo'yicha o'lcham zanjiri, chapda —
 * gorizontal devorlar bo'yicha. Pastda va o'ngda umumiy o'lcham.
 *
 * `outer` — garaj va terrassa bilan birgalikdagi kontur. Chiziqlar
 * shundan tashqariga chiqariladi, aks holda g'arbga qo'yilgan garaj
 * chap tomondagi butun zanjirni yopib qo'yadi.
 */
function drawDimensions(floor: Floor, outer: Rect): DrawPrimitive[] {
  const { bounds } = floor;
  const out: DrawPrimitive[] = [];

  const clearance = {
    top: round(DIMENSION_OFFSET + Math.max(0, bounds.y - outer.y)),
    bottom: round(
      DIMENSION_OFFSET + Math.max(0, outer.y + outer.length - (bounds.y + bounds.length)),
    ),
    left: round(DIMENSION_OFFSET + Math.max(0, bounds.x - outer.x)),
    right: round(DIMENSION_OFFSET + Math.max(0, outer.x + outer.width - (bounds.x + bounds.width))),
  };

  const xs = chainPositions(floor.rooms.map((room) => [room.rect.x, room.rect.x + room.rect.width]));
  const ys = chainPositions(floor.rooms.map((room) => [room.rect.y, room.rect.y + room.rect.length]));

  for (let i = 0; i < xs.length - 1; i++) {
    const span = xs[i + 1] - xs[i];
    if (span < 0.5) continue;
    out.push({
      kind: 'dimension',
      side: 'top',
      from: { x: xs[i], y: bounds.y },
      to: { x: xs[i + 1], y: bounds.y },
      offset: clearance.top,
      text: formatMeters(span),
    });
  }

  for (let i = 0; i < ys.length - 1; i++) {
    const span = ys[i + 1] - ys[i];
    if (span < 0.5) continue;
    out.push({
      kind: 'dimension',
      side: 'left',
      from: { x: bounds.x, y: ys[i] },
      to: { x: bounds.x, y: ys[i + 1] },
      offset: clearance.left,
      text: formatMeters(span),
    });
  }

  // Umumiy o'lchamlar — pastda va o'ngda, ichki zanjirdan uzoqroqda.
  out.push({
    kind: 'dimension',
    side: 'bottom',
    from: { x: bounds.x, y: bounds.y + bounds.length },
    to: { x: bounds.x + bounds.width, y: bounds.y + bounds.length },
    offset: clearance.bottom,
    text: formatMeters(bounds.width),
  });

  out.push({
    kind: 'dimension',
    side: 'right',
    from: { x: bounds.x + bounds.width, y: bounds.y },
    to: { x: bounds.x + bounds.width, y: bounds.y + bounds.length },
    offset: clearance.right,
    text: formatMeters(bounds.length),
  });

  return out;
}

/** Takrorlanuvchi koordinatalarni birlashtirib, o'sish tartibida qaytaradi. */
function chainPositions(pairs: number[][]): number[] {
  const unique = new Set<number>();
  for (const pair of pairs) {
    for (const value of pair) unique.add(round(value));
  }
  return [...unique].sort((a, b) => a - b);
}

function formatMeters(value: number): string {
  return `${value.toFixed(2).replace(/\.?0+$/, '')} m`;
}

// ---------------------------------------------------------------------------
//  SVG
// ---------------------------------------------------------------------------

export interface SvgOptions {
  /** 1 metr necha piksel. */
  scale?: number;
  /**
   * Ranglar `currentColor` dan olinadi — shunda chizma yorug' va qorong'i
   * mavzuda ham to'g'ri ko'rinadi, qayta chizish shart emas.
   */
  color?: string;
  background?: string;
  showLabels?: boolean;
  /**
   * Chizmaning ekran o'quvchi uchun nomi.
   *
   * `role="img"` nomsiz turgan edi: ekran o'quvchi "rasm" deb o'qib,
   * nima ekanini aytmasdi. Bo'sh qoldirilsa `role` ham qo'yilmaydi —
   * nomsiz `role="img"` dan ko'ra bezak sifatida o'tkazib yuborilgani
   * yaxshiroq.
   */
  label?: string;
}

export function toSvg(drawing: Drawing, options: SvgOptions = {}): string {
  const { scale = 40, color = 'currentColor', background, showLabels = true, label } = options;

  const { viewBox } = drawing;
  const width = round(viewBox.width * scale, 1);
  const height = round(viewBox.height * scale, 1);
  const px = (value: number) => round((value - viewBox.x) * scale, 2);
  const py = (value: number) => round((value - viewBox.y) * scale, 2);
  const len = (value: number) => round(value * scale, 2);

  const parts: string[] = [];

  if (background) {
    parts.push(`<rect width="${width}" height="${height}" fill="${background}"/>`);
  }

  for (const primitive of drawing.primitives) {
    switch (primitive.kind) {
      case 'room': {
        const points = primitive.points.map((p) => `${px(p.x)},${py(p.y)}`).join(' ');
        parts.push(
          `<polygon points="${points}" fill="${color}" fill-opacity="0.05" data-room="${primitive.roomId}" data-type="${primitive.roomType}"/>`,
        );
        break;
      }

      case 'wall':
        parts.push(
          `<line x1="${px(primitive.from.x)}" y1="${py(primitive.from.y)}" x2="${px(primitive.to.x)}" y2="${py(primitive.to.y)}"` +
            ` stroke="${color}" stroke-width="${len(primitive.thickness)}" stroke-linecap="butt"` +
            ` opacity="${primitive.exterior ? 1 : 0.75}" data-wall="${primitive.wallId}"/>`,
        );
        break;

      case 'window':
        parts.push(
          `<line x1="${px(primitive.from.x)}" y1="${py(primitive.from.y)}" x2="${px(primitive.to.x)}" y2="${py(primitive.to.y)}"` +
            ` stroke="${color}" stroke-width="${len(primitive.thickness)}" opacity="0.18"/>`,
          `<line x1="${px(primitive.from.x)}" y1="${py(primitive.from.y)}" x2="${px(primitive.to.x)}" y2="${py(primitive.to.y)}"` +
            ` stroke="${color}" stroke-width="${Math.max(1, len(0.04))}" data-opening="${primitive.openingId}"/>`,
        );
        break;

      case 'door-leaf':
        parts.push(
          `<line x1="${px(primitive.from.x)}" y1="${py(primitive.from.y)}" x2="${px(primitive.to.x)}" y2="${py(primitive.to.y)}"` +
            ` stroke="${color}" stroke-width="${Math.max(1, len(0.05))}" data-opening="${primitive.openingId}"/>`,
        );
        break;

      case 'door-arc': {
        const { hinge, radius, startAngle, sweep } = primitive;
        const sx = hinge.x + Math.cos(startAngle) * radius;
        const sy = hinge.y + Math.sin(startAngle) * radius;
        const ex = hinge.x + Math.cos(startAngle + sweep) * radius;
        const ey = hinge.y + Math.sin(startAngle + sweep) * radius;

        parts.push(
          `<path d="M ${px(sx)} ${py(sy)} A ${len(radius)} ${len(radius)} 0 0 ${sweep > 0 ? 1 : 0} ${px(ex)} ${py(ey)}"` +
            ` fill="none" stroke="${color}" stroke-width="${Math.max(0.5, len(0.02))}" opacity="0.45"/>`,
        );
        break;
      }

      case 'stairs': {
        const { at, width: w, length: l, steps } = primitive;
        parts.push(
          `<rect x="${px(at.x)}" y="${py(at.y)}" width="${len(w)}" height="${len(l)}"` +
            ` fill="none" stroke="${color}" stroke-width="${Math.max(1, len(0.04))}" opacity="0.7"/>`,
        );
        for (let i = 1; i < steps; i++) {
          const y = at.y + (l / steps) * i;
          parts.push(
            `<line x1="${px(at.x)}" y1="${py(y)}" x2="${px(at.x + w)}" y2="${py(y)}"` +
              ` stroke="${color}" stroke-width="${Math.max(0.5, len(0.02))}" opacity="0.45"/>`,
          );
        }
        break;
      }

      case 'label': {
        if (!showLabels) break;
        const fontSize = Math.max(8, len(0.32));
        parts.push(
          `<text x="${px(primitive.at.x)}" y="${py(primitive.at.y)}" text-anchor="middle"` +
            ` font-family="system-ui, sans-serif" font-size="${fontSize}" fill="${color}">${escapeXml(primitive.title)}</text>`,
          `<text x="${px(primitive.at.x)}" y="${py(primitive.at.y) + fontSize * 1.15}" text-anchor="middle"` +
            ` font-family="ui-monospace, monospace" font-size="${fontSize * 0.8}" fill="${color}" opacity="0.6">${escapeXml(primitive.subtitle)}</text>`,
        );
        break;
      }

      case 'dimension': {
        const outward = dimensionOffset(primitive.side, primitive.offset);
        const x1 = px(primitive.from.x + outward.x);
        const y1 = py(primitive.from.y + outward.y);
        const x2 = px(primitive.to.x + outward.x);
        const y2 = py(primitive.to.y + outward.y);
        const fontSize = Math.max(7, len(0.24));
        const vertical = primitive.side === 'left' || primitive.side === 'right';

        parts.push(
          `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="0.7" opacity="0.5"/>`,
          `<text x="${(x1 + x2) / 2}" y="${(y1 + y2) / 2}" text-anchor="middle" dominant-baseline="middle"` +
            ` font-family="ui-monospace, monospace" font-size="${fontSize}" fill="${color}" opacity="0.7"` +
            (vertical ? ` transform="rotate(-90 ${(x1 + x2) / 2} ${(y1 + y2) / 2})"` : '') +
            `>${escapeXml(primitive.text)}</text>`,
        );
        break;
      }

      case 'extra': {
        const { rect, enclosed, title, extraKind, extraId } = primitive;
        const fontSize = Math.max(7, len(0.26));

        // Yopiq hajm (garaj, sauna) to'liq chiziq bilan, ochig'i (terrassa,
        // balkon) uzuq chiziq bilan — chizmada darhol farqlanadi.
        parts.push(
          `<rect x="${px(rect.x)}" y="${py(rect.y)}" width="${len(rect.width)}" height="${len(rect.length)}"` +
            ` fill="${color}" fill-opacity="0.04" stroke="${color}"` +
            ` stroke-width="${len(enclosed ? 0.25 : 0.08)}"` +
            (enclosed ? '' : ` stroke-dasharray="${len(0.4)} ${len(0.25)}"`) +
            ` opacity="${enclosed ? 0.85 : 0.55}" data-extra="${extraId}" data-kind="${extraKind}"/>`,
          `<text x="${px(rect.x + rect.width / 2)}" y="${py(rect.y + rect.length / 2)}" text-anchor="middle"` +
            ` dominant-baseline="middle" font-family="ui-monospace, monospace" font-size="${fontSize}"` +
            ` fill="${color}" opacity="0.65">${escapeXml(title)}</text>`,
        );
        break;
      }

      case 'gap':
        // Ochiqlik joyi bo'sh qoladi — devor allaqachon uzilgan.
        break;
    }
  }

  const described = label
    ? ` role="img" aria-label="${escapeXml(label)}"`
    : ' aria-hidden="true"';

  return (
    `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}"${described}>` +
    parts.join('') +
    '</svg>'
  );
}

function dimensionOffset(side: 'top' | 'bottom' | 'left' | 'right', offset: number): Point2 {
  switch (side) {
    case 'top':
      return { x: 0, y: -offset };
    case 'bottom':
      return { x: 0, y: offset };
    case 'left':
      return { x: -offset, y: 0 };
    case 'right':
      return { x: offset, y: 0 };
  }
}

// ---------------------------------------------------------------------------

function cornersOf(room: Room): Point2[] {
  const { x, y, width, length } = room.rect;
  return [
    { x, y },
    { x: round(x + width), y },
    { x: round(x + width), y: round(y + length) },
    { x, y: round(y + length) },
  ];
}

function unit(wall: Wall): Point2 {
  const dx = wall.to.x - wall.from.x;
  const dy = wall.to.y - wall.from.y;
  const length = Math.hypot(dx, dy) || 1;
  return { x: dx / length, y: dy / length };
}

function along(wall: Wall, distance: number): Point2 {
  const direction = unit(wall);
  return {
    x: round(wall.from.x + direction.x * distance),
    y: round(wall.from.y + direction.y * distance),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const list = out.get(k);
    if (list) list.push(item);
    else out.set(k, [item]);
  }
  return out;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
