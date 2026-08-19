import { currency, intlLocale, pdfCopy, pdfDisclaimer } from '@/i18n/pdf';
import type { Locale } from '@/i18n/locales';
import type { EstimateResult } from '@/services/estimate.service';

export interface PdfFloor {
  level: number;
  svg: string;
  rooms: Array<{ roomType: string; label?: string; area: number }>;
}

export interface PdfInput {
  locale: Locale;
  title: string;
  note?: string | null;
  styleName: string;
  finishName: string;
  floors: PdfFloor[];
  estimate: EstimateResult;
  names: Record<string, string>;
  optionNames?: Record<string, Record<string, string>>;
  watermark: boolean;
  generatedAt: Date;
}



export function renderProjectPdf(input: PdfInput): string {
  const { estimate } = input;
  const totalArea = estimate.measurements.FLOOR_AREA;

  return `<!doctype html>
<html lang="uz">
<head>
<meta charset="utf-8">
<title>${escapeHtml(input.title)}</title>
<style>
  @page { size: A4; margin: 14mm 14mm 16mm; }

  :root {
    --ink: #17131F;
    --ink-2: #4A4358;
    --ink-3: #7C748C;
    --line: #DDD8E6;
    --accent: #6538D9;
    --surface: #F7F5FB;
  }

  * { box-sizing: border-box; }

  body {
    margin: 0;
    font-family: "Segoe UI", system-ui, sans-serif;
    font-size: 10pt;
    line-height: 1.5;
    color: var(--ink);
    ${input.watermark ? 'position: relative;' : ''}
  }

  h1 { font-size: 22pt; margin: 0 0 4pt; letter-spacing: -0.01em; }
  h2 {
    font-size: 13pt; margin: 0 0 8pt; padding-bottom: 4pt;
    border-bottom: 1.5pt solid var(--ink);
  }
  h3 { font-size: 10.5pt; margin: 0 0 6pt; color: var(--ink); }
  p { margin: 0 0 6pt; color: var(--ink-2); }

  .page { page-break-after: always; }
  .page:last-child { page-break-after: auto; }

  header.cover { margin-bottom: 14pt; }
  .brand {
    font-size: 8pt; letter-spacing: .18em; text-transform: uppercase;
    color: var(--accent); font-weight: 700; margin-bottom: 10pt;
  }
  .subtitle { color: var(--ink-3); font-size: 10pt; margin-bottom: 14pt; }

  .facts { display: flex; flex-wrap: wrap; gap: 6pt; margin-bottom: 16pt; }
  .fact {
    border: 0.75pt solid var(--line); border-radius: 3pt;
    padding: 5pt 9pt; min-width: 80pt; background: var(--surface);
  }
  .fact b { display: block; font-size: 13pt; font-variant-numeric: tabular-nums; }
  .fact span {
    font-size: 7pt; letter-spacing: .1em; text-transform: uppercase; color: var(--ink-3);
  }

  .plan { text-align: center; margin: 10pt 0 14pt; color: var(--ink); }
  .plan svg { max-width: 100%; height: auto; }

  table { width: 100%; border-collapse: collapse; font-size: 9pt; }
  th {
    text-align: left; font-size: 7.5pt; letter-spacing: .1em; text-transform: uppercase;
    color: var(--ink-3); font-weight: 500; padding: 0 6pt 4pt 0;
    border-bottom: 1pt solid var(--line);
  }
  td { padding: 4pt 6pt 4pt 0; border-bottom: 0.5pt solid var(--line); color: var(--ink-2); }
  td:first-child { color: var(--ink); }
  .right { text-align: right; font-variant-numeric: tabular-nums; white-space: nowrap; }
  tr.group td {
    background: var(--surface); font-weight: 600; color: var(--ink);
    border-bottom: 0.75pt solid var(--line);
  }
  tr.total td {
    border-top: 1.5pt solid var(--ink); border-bottom: none;
    font-size: 12pt; font-weight: 700; color: var(--ink); padding-top: 7pt;
  }

  .disclaimer {
    margin-top: 14pt; padding: 8pt 10pt; border: 0.75pt solid #C9A227;
    background: #FBF4DE; border-radius: 3pt; font-size: 8.5pt; color: var(--ink);
  }

  footer.meta {
    margin-top: 16pt; padding-top: 6pt; border-top: 0.5pt solid var(--line);
    font-size: 7.5pt; color: var(--ink-3); display: flex; justify-content: space-between;
  }

  ${input.watermark ? watermarkCss(pdfCopy(input.locale).watermark) : ''}
</style>
</head>
<body>

${coverPage(input, totalArea)}
${input.floors.map((floor) => floorPage(floor, input)).join('\n')}
${estimatePage(input)}

</body>
</html>`;
}

function coverPage(input: PdfInput, totalArea: number): string {
  const { estimate } = input;
  const t = pdfCopy(input.locale);

  return `<section class="page">
  <header class="cover">
    <div class="brand">${t.brand}</div>
    <h1>${escapeHtml(input.title)}</h1>
    <div class="subtitle">
      ${escapeHtml(input.styleName)} ${t.styleSuffix} ·
      ${input.floors.length} ${t.floors} ·
      ${formatDate(input.generatedAt)}
    </div>
    ${input.note ? `<p>${escapeHtml(input.note)}</p>` : ''}
  </header>

  <div class="facts">
    ${fact(formatNumber(totalArea, input.locale) + ' m²', t.totalArea)}
    ${fact(String(estimate.measurements.ROOM_COUNT), t.rooms)}
    ${fact(String(estimate.measurements.WINDOW_COUNT), t.windows)}
    ${fact(String(estimate.measurements.DOOR_COUNT), t.doors)}
    ${fact(formatNumber(estimate.measurements.ROOF_AREA, input.locale) + ' m²', t.roofArea)}
    ${fact(formatSum(estimate.total, input.locale), t.estimatedPrice)}
  </div>

  ${input.floors[0] ? `<div class="plan">${input.floors[0].svg}</div>` : ''}

  <h3>${t.metrics}</h3>
  <table>
    <tbody>
      ${row(t.perimeter, formatNumber(estimate.measurements.PERIMETER, input.locale) + ' m')}
      ${row(t.exteriorWallArea, formatNumber(estimate.measurements.EXTERIOR_WALL_AREA, input.locale) + ' m²')}
      ${row(t.interiorWallArea, formatNumber(estimate.measurements.INTERIOR_WALL_AREA, input.locale) + ' m²')}
      ${row(t.foundationVolume, formatNumber(estimate.measurements.FOUNDATION_VOLUME, input.locale) + ' m³')}
      ${extraRow(t.garage, estimate.measurements.GARAGE_AREA, input.locale)}
      ${extraRow(t.terrace, estimate.measurements.TERRACE_AREA, input.locale)}
      ${extraRow(t.balcony, estimate.measurements.BALCONY_AREA, input.locale)}
      ${extraRow(t.basement, estimate.measurements.BASEMENT_AREA, input.locale)}
    </tbody>
  </table>

  ${footer(input)}
</section>`;
}

function floorPage(floor: PdfFloor, input: PdfInput): string {
  const t = pdfCopy(input.locale);
  const total = floor.rooms.reduce((sum, room) => sum + room.area, 0);

  return `<section class="page">
  <h2>${floor.level}. ${t.floorPlan}</h2>
  <div class="plan">${floor.svg}</div>

  <h3>${t.rooms}</h3>
  <table>
    <thead>
      <tr><th>${t.room}</th><th class="right">${t.area}</th><th class="right">${t.share}</th></tr>
    </thead>
    <tbody>
      ${floor.rooms
        .map(
          (room) => `<tr>
        <td>${escapeHtml(room.label ?? input.names[room.roomType] ?? room.roomType)}</td>
        <td class="right">${formatNumber(room.area, input.locale)} m²</td>
        <td class="right">${total > 0 ? Math.round((room.area / total) * 100) : 0}%</td>
      </tr>`,
        )
        .join('')}
      <tr class="total">
        <td>Jami</td>
        <td class="right">${formatNumber(total, input.locale)} m²</td>
        <td class="right">100%</td>
      </tr>
    </tbody>
  </table>

  ${footer(input)}
</section>`;
}

function estimatePage(input: PdfInput): string {
  const { estimate } = input;
  const t = pdfCopy(input.locale);

  const byCategory = new Map<string, typeof estimate.lines>();
  for (const line of estimate.lines) {
    const list = byCategory.get(line.category);
    if (list) list.push(line);
    else byCategory.set(line.category, [line]);
  }

  const ordered = [
    ...estimate.categories.map((row) => row.category as string).filter((code) => byCategory.has(code)),
    ...[...byCategory.keys()].filter(
      (code) => !estimate.categories.some((row) => row.category === code),
    ),
  ];

  const groups = ordered.map((category) => {
    const lines = byCategory.get(category)!;
    const total = lines.reduce((sum, line) => sum + line.total, 0);

    return `<tr class="group">
      <td colspan="3">${t.categories[category] ?? category}</td>
      <td class="right">${formatSum(total, input.locale)}</td>
    </tr>
    ${lines
      .map(
        (line) => `<tr>
      <td>${escapeHtml(translated(line.name, input.locale))}${materialNote(input, line)}</td>
      <td class="right">${formatNumber(line.quantity, input.locale)} ${escapeHtml(line.unit)}</td>
      <td class="right">${formatSum(line.unitPrice, input.locale)}</td>
      <td class="right">${formatSum(line.total, input.locale)}</td>
    </tr>`,
      )
      .join('')}`;
  });

  return `<section class="page">
  <h2>${estimate.confidence >= 1 ? t.estimate : t.estimateApproximate}</h2>
  <p>
    ${t.finishLevel}: <strong>${escapeHtml(input.finishName)}</strong> ·
    ${t.perSquareMetre}: <strong>${formatSum(estimate.perSquareMeter, input.locale)}</strong> ·
    ${t.accuracy}: <strong>${confidenceLabel(estimate.confidence, input.locale)}</strong>
  </p>

  <table>
    <thead>
      <tr>
        <th>${t.workType}</th><th class="right">${t.quantity}</th>
        <th class="right">${t.unitPrice}</th><th class="right">${t.sum}</th>
      </tr>
    </thead>
    <tbody>
      ${groups.join('')}
      <tr>
        <td colspan="3">${t.contingency} (${contingencyPercent(estimate)}%)</td>
        <td class="right">${formatSum(estimate.contingency, input.locale)}</td>
      </tr>
      <tr class="total">
        <td colspan="3">${t.total}</td>
        <td class="right">${formatSum(estimate.total, input.locale)}</td>
      </tr>
    </tbody>
  </table>

  <div class="disclaimer">${escapeHtml(pdfDisclaimer(input.locale))}</div>

  ${footer(input)}
</section>`;
}

function materialNote(input: PdfInput, line: EstimateResult['lines'][number]): string {
  if (line.source === 'user') return ` <i>(${pdfCopy(input.locale).ownPrice})</i>`;
  if (line.source !== 'option' || !line.optionCode) return '';

  const name = input.optionNames?.[line.code]?.[line.optionCode] ?? line.optionCode;
  return ` <i>(${escapeHtml(name)})</i>`;
}

function confidenceLabel(confidence: number, locale: Locale): string {
  const t = pdfCopy(locale);

  if (confidence >= 1) return t.exact;
  if (confidence > 0) return `${t.partial} (${Math.round(confidence * 100)}%)`;
  return t.approximate;
}

function contingencyPercent(estimate: EstimateResult): number {
  if (estimate.subtotal <= 0) return 0;
  return Math.round((estimate.contingency / estimate.subtotal) * 100);
}

function fact(value: string, label: string): string {
  return `<div class="fact"><b>${escapeHtml(value)}</b><span>${escapeHtml(label)}</span></div>`;
}

function row(label: string, value: string): string {
  return `<tr><td>${escapeHtml(label)}</td><td class="right">${escapeHtml(value)}</td></tr>`;
}

function extraRow(label: string, area: number, locale: Locale): string {
  return area > 0 ? row(label, `${formatNumber(area, locale)} m²`) : '';
}

function footer(input: PdfInput): string {
  return `<footer class="meta">
    <span>ArchAI · ${escapeHtml(input.title)}</span>
    <span>${formatDate(input.generatedAt)}</span>
  </footer>`;
}

function watermarkCss(label: string): string {
  return `body::before {
    content: "${label}";
    position: fixed;
    top: 45%; left: 50%;
    transform: translate(-50%, -50%) rotate(-32deg);
    font-size: 52pt; font-weight: 700;
    color: rgba(101, 56, 217, 0.08);
    letter-spacing: .04em;
    pointer-events: none;
    z-index: 1000;
  }`;
}

function translated(value: unknown, locale: Locale): string {
  if (typeof value === 'string') return value;
  const record = (value ?? {}) as Record<string, string | undefined>;
  return record[locale] || record.uz || record.ru || record.en || '';
}

export function formatNumber(value: number, locale: Locale): string {
  return new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 1 }).format(value);
}

export function formatSum(value: number, locale: Locale): string {
  const amount = new Intl.NumberFormat(intlLocale(locale), { maximumFractionDigits: 0 }).format(value);
  return `${amount} ${currency(locale)}`;
}

function formatDate(date: Date): string {
  return new Intl.DateTimeFormat('uz-UZ', { dateStyle: 'long' }).format(date);
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
