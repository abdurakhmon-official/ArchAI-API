const { cpSync, existsSync, mkdirSync, rmSync, writeFileSync } = require('node:fs');
const { join, resolve } = require('node:path');

const FOLDERS = [
  { name: 'geometry', label: 'geometriya yadrosi' },
  { name: 'shared', label: 'smeta hisobi' },
];

const apiRoot = resolve(__dirname, '..');
const uiRoot = resolve(apiRoot, '..', 'ui');

if (!existsSync(uiRoot)) {
  console.warn('sync-geometry: ui/ topilmadi, sinxron o\'tkazib yuborildi');
  process.exit(0);
}

for (const folder of FOLDERS) {
  const source = resolve(apiRoot, folder.name);
  const target = resolve(uiRoot, 'lib', folder.name);

  if (!existsSync(source)) {
    console.error(`sync-geometry: manba topilmadi — ${source}`);
    process.exit(1);
  }

  rmSync(target, { recursive: true, force: true });
  mkdirSync(target, { recursive: true });

  cpSync(source, target, {
    recursive: true,
    filter: (path) => !path.includes('__tests__') && !path.endsWith('.spec.ts'),
  });

  writeFileSync(
    join(target, 'README.md'),
    [
      '# AVTOMATIK NUSXA — tahrirlamang',
      '',
      `Bu papka \`api/${folder.name}/\` (${folder.label}) dan nusxalanadi:`,
      '',
      '```',
      'node api/scripts/sync-geometry.js',
      '```',
      '',
      'U `ui` ning `predev` va `prebuild` skriptlarida avtomatik ishga tushadi.',
      'Bu yerdagi har qanday o\'zgarish keyingi sinxronda yo\'qoladi —',
      `manbani, ya'ni \`api/${folder.name}/\` ni tahrirlang.`,
      '',
    ].join('\n'),
    'utf8',
  );

  console.log(`sync-geometry: ${source} -> ${target}`);
}
