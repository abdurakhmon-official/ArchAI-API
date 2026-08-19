import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';

interface Sample {
  title: string;
  note: string;
  svg: string;
  rooms: number;
  score: number;
  rawScore: number;
  carved: number;
  rebalanced: boolean;
  issues: string[];
  triangles: number;
  measurements: Record<string, number>;
}

const samples: Sample[] = JSON.parse(
  readFileSync(join(__dirname, 'samples.json'), 'utf8'),
);

const outputPath = process.argv[2] ?? join(__dirname, 'samples.html');

const escape = (value: string) =>
  value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const METRIC_LABELS: Record<string, string> = {
  FLOOR_AREA: 'Pol maydoni',
  PERIMETER: 'Perimetr',
  EXTERIOR_WALL_AREA: 'Tashqi devor',
  INTERIOR_WALL_AREA: 'Ichki devor',
  ROOF_AREA: 'Tom yuzasi',
  FOUNDATION_VOLUME: 'Poydevor',
  WINDOW_COUNT: 'Deraza',
  DOOR_COUNT: 'Eshik',
};

const METRIC_UNITS: Record<string, string> = {
  FLOOR_AREA: 'm²',
  PERIMETER: 'm',
  EXTERIOR_WALL_AREA: 'm²',
  INTERIOR_WALL_AREA: 'm²',
  ROOF_AREA: 'm²',
  FOUNDATION_VOLUME: 'm³',
  WINDOW_COUNT: 'ta',
  DOOR_COUNT: 'ta',
};

function scoreClass(score: number): string {
  if (score >= 95) return 'good';
  if (score >= 75) return 'ok';
  return 'poor';
}

const cards = samples
  .map((sample) => {
    const metrics = Object.keys(METRIC_LABELS)
      .map(
        (key) =>
          `<div><dt>${METRIC_LABELS[key]}</dt><dd>${sample.measurements[key]}<span>${METRIC_UNITS[key]}</span></dd></div>`,
      )
      .join('');

    const issues = sample.issues.length
      ? `<ul class="issues">${sample.issues
          .map((issue) => {
            const [severity, ...rest] = issue.split(': ');
            return `<li class="${severity}"><b>${severity === 'error' ? 'xato' : 'ogoh'}</b>${escape(rest.join(': '))}</li>`;
          })
          .join('')}</ul>`
      : '<p class="clean">Hech qanday muammo topilmadi.</p>';

    const delta =
      sample.score === sample.rawScore
        ? ''
        : `<span class="delta">${sample.rawScore} → ${sample.score}</span>`;

    return `<article class="card">
      <header>
        <h2>${escape(sample.title)}</h2>
        <p>${escape(sample.note)}</p>
        <div class="badges">
          <span class="badge ${scoreClass(sample.score)}">Sifat ${sample.score}${delta}</span>
          <span class="badge">${sample.rooms} xona</span>
          <span class="badge">${sample.carved} koridor</span>
          <span class="badge">${sample.triangles} uchburchak</span>
        </div>
      </header>
      <figure>${sample.svg}</figure>
      <dl class="metrics">${metrics}</dl>
      ${issues}
    </article>`;
  })
  .join('\n');

const totals = {
  samples: samples.length,
  perfect: samples.filter((sample) => sample.score >= 100).length,
  errors: samples.reduce(
    (sum, sample) => sum + sample.issues.filter((issue) => issue.startsWith('error')).length,
    0,
  ),
  triangles: samples.reduce((sum, sample) => sum + sample.triangles, 0),
};

const html = `<title>ArchAI Geometriya Namunalari</title>
<style>
  :root {
    --paper:#FBFAFD; --surface:#FFFFFF; --surface-2:#F4F1F9;
    --ink:#17131F; --ink-2:#4A4358; --ink-3:#7C748C;
    --line:#E4DFEC; --line-strong:#CFC7DE;
    --accent:#6538D9; --accent-2:#EEE8FD; --accent-ink:#4A24A8;
    --ok:#0F7A5A; --ok-bg:#E6F4EF;
    --warn:#8A5A05; --warn-bg:#FBF0DC;
    --crit:#A83341; --crit-bg:#FBE9EB;
    --grid:rgba(101,56,217,.07);
    --display:"Iowan Old Style","Palatino Linotype",Palatino,Georgia,serif;
    --body:system-ui,"Segoe UI",Roboto,sans-serif;
    --mono:"Cascadia Mono",Consolas,ui-monospace,monospace;
  }
  @media (prefers-color-scheme: dark) {
    :root:not([data-theme="light"]) {
      --paper:#0F0C15; --surface:#171224; --surface-2:#1E1831;
      --ink:#EDE9F6; --ink-2:#B4ABC6; --ink-3:#877E9B;
      --line:#2A2239; --line-strong:#3D3253;
      --accent:#A98BFF; --accent-2:#241C3A; --accent-ink:#C7B2FF;
      --ok:#52CFA5; --ok-bg:#12302A;
      --warn:#E0A83C; --warn-bg:#34260F;
      --crit:#F0808E; --crit-bg:#37181E;
      --grid:rgba(169,139,255,.09);
    }
  }
  :root[data-theme="dark"] {
    --paper:#0F0C15; --surface:#171224; --surface-2:#1E1831;
    --ink:#EDE9F6; --ink-2:#B4ABC6; --ink-3:#877E9B;
    --line:#2A2239; --line-strong:#3D3253;
    --accent:#A98BFF; --accent-2:#241C3A; --accent-ink:#C7B2FF;
    --ok:#52CFA5; --ok-bg:#12302A;
    --warn:#E0A83C; --warn-bg:#34260F;
    --crit:#F0808E; --crit-bg:#37181E;
    --grid:rgba(169,139,255,.09);
  }

  * { box-sizing: border-box; }
  body {
    margin:0; background:var(--paper); color:var(--ink);
    font-family:var(--body); font-size:15.5px; line-height:1.6;
    -webkit-font-smoothing:antialiased;
  }

  header.top {
    border-bottom:1px solid var(--line-strong);
    background:
      repeating-linear-gradient(to right, var(--grid) 0 1px, transparent 1px 32px),
      repeating-linear-gradient(to bottom, var(--grid) 0 1px, transparent 1px 32px),
      var(--surface);
  }
  .top-inner { max-width:1180px; margin:0 auto; padding:56px 32px 36px; display:flex; flex-direction:column; gap:16px; }
  .eyebrow { font-family:var(--mono); font-size:11.5px; letter-spacing:.16em; text-transform:uppercase; color:var(--accent-ink); margin:0; }
  h1 { font-family:var(--display); font-weight:600; font-size:clamp(2.2rem,5.5vw,3.4rem); line-height:1.05; letter-spacing:-.015em; margin:0; max-width:16ch; text-wrap:balance; }
  .deck { font-size:1.08rem; color:var(--ink-2); max-width:64ch; margin:0; }
  .tally { display:flex; flex-wrap:wrap; gap:10px; margin-top:8px; padding-top:18px; border-top:1px solid var(--line); }
  .tally div { border:1px solid var(--line); background:var(--surface-2); border-radius:4px; padding:7px 12px; display:flex; flex-direction:column; min-width:96px; }
  .tally b { font-family:var(--mono); font-size:1.15rem; font-variant-numeric:tabular-nums; color:var(--accent-ink); line-height:1.2; }
  .tally span { font-family:var(--mono); font-size:10px; letter-spacing:.1em; text-transform:uppercase; color:var(--ink-3); }

  main { max-width:1180px; margin:0 auto; padding:40px 32px 96px; display:grid; gap:28px; grid-template-columns:repeat(auto-fill,minmax(440px,1fr)); }

  .card { border:1px solid var(--line); border-radius:6px; background:var(--surface); padding:20px; display:flex; flex-direction:column; gap:14px; }
  .card header { display:flex; flex-direction:column; gap:6px; }
  .card h2 { font-family:var(--display); font-size:1.25rem; font-weight:600; margin:0; letter-spacing:-.01em; }
  .card header p { margin:0; font-size:13.5px; color:var(--ink-3); }

  .badges { display:flex; flex-wrap:wrap; gap:6px; margin-top:4px; }
  .badge { font-family:var(--mono); font-size:10.5px; letter-spacing:.05em; text-transform:uppercase; padding:3px 8px; border-radius:3px; background:var(--surface-2); border:1px solid var(--line); color:var(--ink-2); font-weight:600; }
  .badge.good { background:var(--ok-bg); border-color:var(--ok); color:var(--ok); }
  .badge.ok { background:var(--warn-bg); border-color:var(--warn); color:var(--warn); }
  .badge.poor { background:var(--crit-bg); border-color:var(--crit); color:var(--crit); }
  .badge .delta { opacity:.65; margin-left:5px; font-weight:400; text-transform:none; }

  figure { margin:0; padding:14px; border:1px solid var(--line); border-radius:5px; background:var(--surface-2); overflow-x:auto; color:var(--ink); }
  figure svg { display:block; max-width:100%; height:auto; margin:0 auto; }

  .metrics { display:grid; grid-template-columns:repeat(auto-fill,minmax(104px,1fr)); gap:8px; margin:0; }
  .metrics div { border:1px solid var(--line); border-radius:4px; padding:6px 9px; background:var(--surface-2); }
  .metrics dt { font-family:var(--mono); font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; color:var(--ink-3); }
  .metrics dd { margin:1px 0 0; font-family:var(--mono); font-size:14px; font-variant-numeric:tabular-nums; color:var(--ink); }
  .metrics dd span { font-size:10px; color:var(--ink-3); margin-left:3px; }

  .issues { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:5px; }
  .issues li { font-size:12.5px; padding:5px 9px; border-radius:4px; display:flex; gap:8px; align-items:baseline; }
  .issues li b { font-family:var(--mono); font-size:9.5px; letter-spacing:.08em; text-transform:uppercase; flex:none; }
  .issues .warning { background:var(--warn-bg); color:var(--ink); }
  .issues .warning b { color:var(--warn); }
  .issues .error { background:var(--crit-bg); color:var(--ink); }
  .issues .error b { color:var(--crit); }
  .clean { margin:0; font-size:12.5px; color:var(--ok); font-family:var(--mono); }

  @media (max-width:900px) {
    main { grid-template-columns:1fr; padding:30px 20px 64px; }
    .top-inner { padding:40px 20px 30px; }
  }
</style>

<header class="top">
  <div class="top-inner">
    <p class="eyebrow">Geometriya dvigateli &nbsp;·&nbsp; haqiqiy chiqish</p>
    <h1>Generatsiya qilingan rejalar</h1>
    <p class="deck">
      Quyidagi chizmalarning hech biri qo'lda chizilmagan. Har biri bo'linish daraxtidan
      hisoblab chiqarilgan: devorlar, eshiklar, derazalar, o'lchamlar va smeta miqdorlari —
      hammasi bir xil ma'lumotdan. Xona qo'shilsa yoki uy o'lchami o'zgarsa, hammasi qayta
      quriladi.
    </p>
    <div class="tally">
      <div><b>${totals.samples}</b><span>namuna</span></div>
      <div><b>${totals.perfect}</b><span>100 ball</span></div>
      <div><b>${totals.errors}</b><span>xato</span></div>
      <div><b>142</b><span>test</span></div>
      <div><b>${totals.triangles.toLocaleString('en-US')}</b><span>uchburchak</span></div>
    </div>
  </div>
</header>

<main>
${cards}
</main>
`;

writeFileSync(outputPath, html, 'utf8');
console.log(`wrote ${outputPath} (${Math.round(html.length / 1024)} KB)`);
