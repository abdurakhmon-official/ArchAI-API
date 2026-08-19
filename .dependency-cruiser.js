/**
 * Modul chegaralari nazorati.
 *
 * Qatlamli tuzilmada papka devorlari domen chegarasini himoya qilmaydi,
 * shuning uchun tartib shu to'rt qoida bilan saqlanadi. Qoida buzilsa
 * CI yiqiladi — bu 18 hafta davomida tuzilmaning tarqalib ketishining
 * oldini oladigan yagona narsa.
 *
 * @type {import('dependency-cruiser').IConfiguration}
 */
module.exports = {
  forbidden: [
    {
      name: 'geometry-must-stay-pure',
      comment:
        "geometry/ hech narsani import qilmaydi — u ui/lib/geometry ga nusxalanadi va sof qolishi kerak",
      severity: 'error',
      from: { path: '^geometry' },
      to: {
        pathNot: '^geometry',
        dependencyTypesNot: ['core', 'type-only'],
      },
    },
    {
      name: 'no-service-cycles',
      comment:
        'servislar orasida sikl (A -> B -> A) monolitni boshqarib bo\'lmaydigan holga keltiradi — yon ta\'sirlar uchun modules/events.ts ishlating',
      severity: 'error',
      from: {},
      to: { circular: true },
    },
    {
      name: 'service-must-not-import-controller',
      comment: 'bog\'liqlik bir tomonlama qolsin: kontroller -> servis',
      severity: 'error',
      from: { path: '^services' },
      to: { path: '^controllers' },
    },
    {
      name: 'controller-must-not-import-controller',
      comment: 'kontrollerlar bir-birini chaqirmasin — umumiy mantiq servisga tushsin',
      severity: 'error',
      from: { path: '^controllers', pathNot: '^controllers/index\\.ts$' },
      to: { path: '^controllers', pathNot: '^controllers/index\\.ts$' },
    },
    {
      name: 'no-orphans',
      comment: 'hech kim ishlatmaydigan fayl — o\'chirilsinmi yoki ulanmadimi?',
      severity: 'warn',
      from: {
        orphan: true,
        pathNot: [
          '(^|/)\\.[^/]+\\.(js|cjs|mjs|ts|json)$',
          '\\.d\\.ts$',
          '(^|/)tsconfig\\.json$',
          '(^|/)(babel|jest)\\.config\\.(js|cjs|mjs|ts|json)$',
          '^index\\.ts$',
          '^server\\.ts$',
        ],
      },
      to: {},
    },
  ],

  options: {
    doNotFollow: { path: 'node_modules' },
    exclude: {
      path: ['node_modules', 'generated', 'dist', '__tests__', '\\.spec\\.ts$'],
    },
    tsPreCompilationDeps: true,
    tsConfig: { fileName: 'tsconfig.json' },
    enhancedResolveOptions: {
      exportsFields: ['exports'],
      conditionNames: ['import', 'require', 'node', 'default', 'types'],
      extensions: ['.js', '.ts'],
    },
    reporterOptions: {
      text: { highlightFocused: true },
    },
  },
};
