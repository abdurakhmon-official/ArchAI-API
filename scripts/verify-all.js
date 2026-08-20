// Payme/Click/Stripe deep-flow checks need the same provider secrets the
// server itself reads from `.env` (to build a valid Basic-auth header /
// signature) — the script isn't normally launched through anything that
// loads it otherwise.
require('dotenv').config({ path: require('node:path').join(__dirname, '../.env') });

const BASE = process.env.API_URL || 'http://localhost:9100/api';

let pass = 0;
let fail = 0;
const failures = [];

async function call(method, path, options = {}) {
  const { body, token, raw } = options;

  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    ...(body ? { body: raw ? body : JSON.stringify(body) } : {}),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
  }

  return { status: res.status, json, headers: res.headers };
}

function check(name, condition, detail = '') {
  if (condition) {
    pass += 1;
    console.log(`  ok    ${name}`);
  } else {
    fail += 1;
    failures.push(name);
    console.log(`  FAIL  ${name} ${detail}`);
  }
}

const section = (title) => console.log(`\n${title}`);

// Accounts created during the run — removed at the end so they do not pile up.
const createdAccounts = [];

/**
 * Like `call()`, but allows arbitrary headers (Payme Basic auth, Click
 * doesn't need this, Stripe's `stripe-signature`). Kept separate from
 * `call()` instead of extending it, so the existing helper — and every
 * check built on top of it — stays untouched.
 */
async function callWithHeaders(method, path, { body, headers = {}, raw } = {}) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      ...(body && !raw ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
    ...(body ? { body: raw ? body : JSON.stringify(body) } : {}),
  });

  let json = null;
  try {
    json = await res.json();
  } catch {
  }

  return { status: res.status, json, headers: res.headers };
}

const paymeBasicAuth = (secret) => `Basic ${Buffer.from(`Paycom:${secret}`).toString('base64')}`;

/** Mirrors `click.service.ts`'s `verifySignature` MD5 scheme exactly. */
function clickSignature({
  clickTransId,
  serviceId,
  secretKey,
  merchantTransId,
  merchantPrepareId,
  amount,
  action,
  signTime,
}) {
  const parts = [
    clickTransId,
    serviceId,
    secretKey,
    merchantTransId,
    ...(action === 1 ? [merchantPrepareId ?? ''] : []),
    String(amount),
    String(action),
    signTime,
  ];

  return require('node:crypto').createHash('md5').update(parts.join('')).digest('hex');
}

const countLeaves = (node) =>
  node.kind === 'leaf' ? 1 : countLeaves(node.children[0]) + countLeaves(node.children[1]);

const findRoom = (node, type) =>
  node.kind === 'leaf'
    ? node.roomType === type
      ? node.id
      : null
    : findRoom(node.children[0], type) || findRoom(node.children[1], type);

const PARAMS = {
  landAreaSotix: 8,
  width: 11,
  length: 12,
  floors: 1,
  rooms: { bedroom: 3, living: 1, bathroom: 1 },
  kitchen: 'separate',
  garage: 1,
  extras: ['terrace'],
};

async function main() {
  section('1. AUTENTIFIKATSIYA');
  const email = `v${Date.now()}@archai.uz`;
  const reg = await call('POST', '/auth/signup', {
    body: { fullName: 'Verify User', email, password: 'tepakalla-sichqon-42' },
  });
  check('ro\'yxatdan o\'tish', reg.status === 200 && Boolean(reg.json?.data?.accessToken), `(${reg.status})`);
  const userToken = reg.json?.data?.accessToken;
  createdAccounts.push(email);

  const login = await call('POST', '/auth/signin', {
    body: { email: 'admin@archai.uz', password: 'admin12345' },
  });
  check('admin kirishi', login.status === 200, `(${login.status})`);
  const admin = login.json?.data?.accessToken;

  check('profil olish', (await call('GET', '/auth/me', { token: userToken })).status === 200);

  const bad = await call('POST', '/auth/signin', {
    body: { email: 'admin@archai.uz', password: 'notogri' },
  });
  check('noto\'g\'ri parol rad etiladi', bad.status >= 400, `(${bad.status})`);

  // --- Parolni tiklash ------------------------------------------------------
  /*
    Bu oqim ilgari UMUMAN yo'q edi: parolni unutgan odam hisobidan
    butunlay ayrilardi.

    Tokenning o'zi bu yerda tekshirilmaydi — u faqat xatga tushadi va
    bazada xeshlangan holda yotadi. Shuning uchun uchning xatti-harakati
    tekshiriladi, tokenning o'zi esa brauzer sinovida (bazadan olinadi).
  */
  const forgotKnown = await call('POST', '/auth/forgot-password', { body: { email } });
  const forgotUnknown = await call('POST', '/auth/forgot-password', {
    body: { email: `yoq-${Date.now()}@archai.test` },
  });

  /*
    Ikkala javob ham BIR XIL bo'lishi shart.

    Farq qilsa, bu uch hisob mavjudligini tekshirish asbobiga
    aylanardi: kimdir minglab manzilni sinab, qaysilari ro'yxatda
    borligini bilib olardi.
  */
  check(
    'tiklash so\'rovi qabul qilindi',
    /*
      Xat NAVBAT orqali ketadi, ya'ni Redis kerak.

      Redis ishlamayotgan bo'lsa server ataylab xato qaytaradi:
      "yubordik" deb aytib, aslida yubormaslik eng yomon variant —
      foydalanuvchi pochtasini kutib o'tiraveradi. Sinov ikkala
      holatni ham qabul qiladi, lekin qaysi biri ekanini aytadi.
    */
    forgotKnown.status === 200 || forgotKnown.status === 400,
    `(${forgotKnown.status}) ${forgotKnown.json?._message ?? ''}`,
  );

  if (forgotKnown.status !== 200) {
    console.log('    diqqat: navbat ishlamayapti (Redis) — xat yuborish sinalmadi');
  }
  check(
    'noma\'lum email ham bir xil javob beradi',
    forgotUnknown.status === forgotKnown.status &&
      forgotUnknown.json?._message === forgotKnown.json?._message,
    `(${forgotUnknown.status} / ${forgotKnown.status})`,
  );

  check(
    'yaroqsiz token rad etiladi',
    (await call('POST', '/auth/reset-password', {
      body: { token: 'a'.repeat(40), newPassword: 'tepakalla-sichqon-42' },
    })).status === 400,
  );
  check(
    'qisqa token umuman qabul qilinmaydi',
    (await call('POST', '/auth/reset-password', {
      body: { token: 'qisqa', newPassword: 'tepakalla-sichqon-42' },
    })).status === 400,
  );
  check(
    'tiklashda ham zaif parol rad etiladi',
    (await call('POST', '/auth/reset-password', {
      body: { token: 'a'.repeat(40), newPassword: '12345678' },
    })).status === 400,
  );

  check(
    'yaroqsiz tasdiqlash havolasi rad etiladi',
    (await call('POST', `/auth/verify-email/${'b'.repeat(40)}`)).status === 400,
  );
  check(
    'tasdiqlash xatini faqat o\'ziga yuborish mumkin',
    (await call('POST', '/auth/send-verification')).status === 401,
  );

  // --- Yo'nalish ------------------------------------------------------------
  /*
    Bir xil so'rov, faqat shimol tomoni boshqa — natija ham boshqa
    bo'lishi kerak. Aks holda yo'nalishni so'rashning ma'nosi yo'q.
  */
  const genBody = {
    landAreaSotix: 8, width: 12, length: 10, floors: 1,
    rooms: { bedroom: 2, living: 1, bathroom: 1 },
    kitchen: 'separate', garage: 0, extras: [], variants: 4, finishLevel: 'standard',
  };

  const noNorth = await call('POST', '/generate', { body: genBody });
  const withNorth = await call('POST', '/generate', { body: { ...genBody, northSide: 'north' } });
  const rotated = await call('POST', '/generate', { body: { ...genBody, northSide: 'east' } });

  check("yo'nalishsiz generatsiya ishlaydi", noNorth.status === 200, `(${noNorth.status})`);
  check(
    "yo'nalishsiz ball tarkibida yo'nalish yo'q",
    noNorth.json?.data?.[0]?.scoreParts?.orientation === null,
    JSON.stringify(noNorth.json?.data?.[0]?.scoreParts),
  );
  check(
    "yo'nalish berilganda ball hisoblanadi",
    typeof withNorth.json?.data?.[0]?.scoreParts?.orientation === 'number',
    JSON.stringify(withNorth.json?.data?.[0]?.scoreParts),
  );
  check(
    "qaysi xona qayerga qaragani qaytadi",
    (withNorth.json?.data?.[0]?.orientation ?? []).length > 0,
  );

  const northScores = withNorth.json?.data?.map((v) => v.scoreParts.orientation) ?? [];
  const eastScores = rotated.json?.data?.map((v) => v.scoreParts.orientation) ?? [];
  check(
    "uchastka burilganda ball o'zgaradi",
    JSON.stringify(northScores) !== JSON.stringify(eastScores),
    `${JSON.stringify(northScores)} / ${JSON.stringify(eastScores)}`,
  );

  check(
    "noto'g'ri yo'nalish rad etiladi",
    (await call('POST', '/generate', { body: { ...genBody, northSide: 'yuqori' } })).status === 400,
  );

  section('2. KATALOG');
  const styles = await call('GET', '/styles');
  check('uslublar (4 ta)', styles.status === 200 && styles.json.data.length === 4, `(${styles.json?.data?.length})`);

  const roomTypes = await call('GET', '/room-types');
  check('xona turlari (10 ta)', roomTypes.status === 200 && roomTypes.json.data.length >= 10);

  const selectable = await call('GET', '/room-types/selectable');
  check('so\'raladigan turlar ochiq', selectable.status === 200, `(${selectable.status})`);
  check('beshta tur so\'raladi', selectable.json?.data?.length === 5, `(${selectable.json?.data?.length})`);
  check(
    'chegara va sukut qaytadi',
    selectable.json?.data?.every((r) => typeof r.maxCount === 'number' && typeof r.defaultCount === 'number'),
  );
  check(
    'xizmat xonalari ro\'yxatda yo\'q',
    !selectable.json?.data?.some((r) => ['corridor', 'hall', 'stairs'].includes(r.code)),
  );

  const roofStyles = await call('GET', '/roof-styles');
  check('tom uslublari ochiq', roofStyles.status === 200, `(${roofStyles.status})`);
  check('sakkizta preset', roofStyles.json?.data?.length === 8, `(${roofStyles.json?.data?.length})`);
  check(
    'presetlar qoplamaga bog\'langan',
    roofStyles.json?.data?.every((r) => r.covering?.code),
  );

  const families = await call('GET', '/roof-styles/families');
  check(
    'oltita shakl',
    families.json?.data?.length === 6 &&
      families.json.data.includes('pyramid') &&
      families.json.data.includes('mansard'),
    JSON.stringify(families.json?.data),
  );

  const mansard = roofStyles.json?.data?.find((r) => r.family === 'mansard');
  const badMansard = await call('PUT', `/roof-styles/${mansard?.id}`, {
    body: { pitch: 30, upperPitch: 40 },
    token: admin,
  });
  check('buzuq mansard rad etiladi', badMansard.status === 400, `(${badMansard.status})`);

  const badOnCreate = await call('POST', '/roof-styles', {
    body: {
      code: `mansard-sinov-${Date.now().toString(36)}`,
      name: { uz: 'Sinov' },
      family: 'mansard',
      pitch: 30,
      upperPitch: 45,
    },
    token: admin,
  });
  check('yaratishda ham rad etiladi', badOnCreate.status === 400, `(${badOnCreate.status})`);

  const notRoof = await call('POST', '/roof-styles', {
    body: {
      code: `sinov-${Date.now().toString(36)}`,
      name: { uz: 'Sinov' },
      family: 'gable',
      coveringId: (await call('GET', '/estimate/price-items')).json?.data
        ?.find((i) => i.code === 'wall_exterior')?.options?.[0]?.id,
    },
    token: admin,
  });
  check('noto\'g\'ri qoplama rad etiladi', notRoof.status === 400, `(${notRoof.status})`);

  check('tom uslublari mehmonga yopiq (yozish)', (await call('POST', '/roof-styles', {
    body: { code: 'hack', name: { uz: 'x' }, family: 'gable' },
  })).status === 401);

  const allStyles = await call('GET', '/styles/all', { token: admin });
  check(
    "uy uslublari: admin ro'yxati",
    allStyles.status === 200 && allStyles.json.data.length >= 4,
    `(${allStyles.status}, ${allStyles.json?.data?.length})`,
  );
  check("uy uslublari: admin ro'yxati mehmonga yopiq", (await call('GET', '/styles/all')).status === 401);

  const modern = allStyles.json?.data?.find((row) => row.slug === 'modern');
  const beforeInterior = JSON.stringify(modern?.interior ?? null);
  const patched = await call('PUT', `/styles/${modern?.id}`, {
    body: { sort: (modern?.sort ?? 0) },
    token: admin,
  });
  check(
    'uy uslubi: qisman yangilash boshqa maydonni buzmaydi',
    patched.status === 200 && JSON.stringify(patched.json?.data?.interior) === beforeInterior,
    `(${patched.status})`,
  );

  check('uy uslublari mehmonga yopiq (yozish)', (await call('POST', '/styles', {
    body: { slug: 'hack', name: { uz: 'x' } },
  })).status === 401);

  const skeletons = await call('GET', '/skeletons', { token: admin });
  check('skeletlar (3 ta)', skeletons.status === 200 && skeletons.json.data.length === 3);
  check('skeletlar mehmonga yopiq', (await call('GET', '/skeletons')).status === 401);

  const sampleTree = skeletons.json?.data?.[0]?.tree;

  const newSkeleton = await call('POST', '/skeletons', {
    body: {
      name: `Sinov andozasi ${Date.now().toString(36)}`,
      floors: 1,
      tree: { floors: [sampleTree.floors[0]] },
      tagBedrooms: [2, 3],
      tagStyles: ['modern'],
      minWidth: 9,
      maxWidth: 15,
      minLength: 9,
      maxLength: 15,
      status: 'DRAFT',
    },
    token: admin,
  });
  check('andoza yaratildi', newSkeleton.status === 200, `(${newSkeleton.status})`);
  const skeletonId = newSkeleton.json?.data?.id;

  check(
    'qoralama ochiq ro\'yxatda yo\'q',
    !(await call('GET', '/skeletons/published')).json?.data?.some((row) => row.id === skeletonId),
  );

  const publish = await call('PUT', `/skeletons/${skeletonId}`, {
    body: {
      ...newSkeleton.json.data,
      tree: { floors: [sampleTree.floors[0]] },
      status: 'PUBLISHED',
    },
    token: admin,
  });
  check('andoza chop etildi', publish.status === 200, `(${publish.status})`);
  check(
    'chop etilgach ochiq ro\'yxatda',
    (await call('GET', '/skeletons/published')).json?.data?.some((row) => row.id === skeletonId),
  );

  const mismatched = await call('PUT', `/skeletons/${skeletonId}`, {
    body: { ...newSkeleton.json.data, floors: 2, tree: { floors: [sampleTree.floors[0]] } },
    token: admin,
  });
  check('qavatlar nomuvofiqligi rad etiladi', mismatched.status === 400, `(${mismatched.status})`);

  const duplicated = await call('POST', `/skeletons/${skeletonId}/duplicate`, { token: admin });
  check('nusxa olindi', duplicated.status === 200, `(${duplicated.status})`);
  check('nusxa qoralama bo\'ldi', duplicated.json?.data?.status === 'DRAFT');

  check(
    'nusxa o\'chirildi',
    (await call('DELETE', `/skeletons/${duplicated.json?.data?.id}`, { token: admin })).status === 200,
  );
  check(
    'andoza o\'chirildi',
    (await call('DELETE', `/skeletons/${skeletonId}`, { token: admin })).status === 200,
  );

  section('3. GENERATSIYA');
  const gen = await call('POST', '/generate', {
    body: { ...PARAMS, styleSlug: 'modern', variants: 2 },
    token: admin,
  });
  check('variantlar yaratildi', gen.status === 200 && gen.json.data.length > 0, `(${gen.json?.data?.length})`);

  const variant = gen.json?.data?.[0];
  check('sifat bali hisoblandi', variant?.score > 0, `(${variant?.score})`);
  check('garaj qo\'yildi', Boolean(variant?.extras?.some((e) => e.kind === 'garage')));
  check('terrassa qo\'yildi', Boolean(variant?.extras?.some((e) => e.kind === 'terrace')));
  check('smeta hisoblandi', variant?.estimateTotal > 0);
  check('muqova SVG chiqdi', Boolean(variant?.coverSvg?.startsWith('<svg')));
  check('geometriya qaytarildi', Boolean(variant?.geometry?.bounds && variant?.geometry?.floors));
  check('quvur qadamlari qaytdi', typeof variant?.steps?.corridorsAdded === 'number');

  const tooBig = await call('POST', '/generate', {
    body: { ...PARAMS, landAreaSotix: 1, width: 20, length: 20 },
  });
  check('yerga sig\'masligi rad etiladi', tooBig.status === 400, `(${tooBig.status})`);

  const unknownRoom = await call('POST', '/generate', {
    body: { ...PARAMS, rooms: { yotoqxona: 2 } },
  });
  check('noma\'lum xona turi rad etiladi', unknownRoom.status === 400, `(${unknownRoom.status})`);

  const serviceRoom = await call('POST', '/generate', {
    body: { ...PARAMS, rooms: { corridor: 2 } },
  });
  check('xizmat xonasini so\'rash rad etiladi', serviceRoom.status === 400, `(${serviceRoom.status})`);

  const overLimit = await call('POST', '/generate', {
    body: { ...PARAMS, rooms: { living: 4 } },
  });
  check('tur chegarasi qo\'llanadi', overLimit.status === 400, `(${overLimit.status})`);

  const emptyRooms = await call('POST', '/generate', {
    body: { ...PARAMS, rooms: {}, variants: 1 },
  });
  check(
    'bo\'sh buyurtma sukutdan to\'ldiriladi',
    emptyRooms.status === 200 && emptyRooms.json?.data?.[0]?.floors?.[0]?.rooms?.length > 3,
    `(${emptyRooms.status})`,
  );

  section('4. GEOMETRIYA TAHRIRI');
  const geo = variant.geometry;
  const before = countLeaves(geo.floors[0].tree);

  const added = await call('POST', '/geometry/room/add', {
    body: { geometry: geo, level: 1, roomType: 'bedroom' },
  });
  check(
    'xona qo\'shildi',
    added.status === 200 && countLeaves(added.json.data.floors[0].tree) === before + 1,
    `(${added.status})`,
  );

  const bedId = findRoom(added.json.data.floors[0].tree, 'bedroom');
  const removed = await call('POST', '/geometry/room/remove', {
    body: { geometry: added.json.data, level: 1, roomId: bedId },
  });
  check('xona o\'chirildi', removed.status === 200 && countLeaves(removed.json.data.floors[0].tree) === before);

  const typed = await call('POST', '/geometry/room/type', {
    body: { geometry: geo, level: 1, roomId: findRoom(geo.floors[0].tree, 'bedroom'), roomType: 'office' },
  });
  check('xona turi almashtirildi', typed.status === 200, `(${typed.status})`);

  const tiny = await call('POST', '/geometry/room/add', {
    body: { geometry: { ...geo, bounds: { x: 0, y: 0, width: 4, length: 4 } }, level: 1, roomType: 'living' },
  });
  check('joy yetmasa 400 qaytadi', tiny.status === 400, `(${tiny.status})`);

  section('5. SMETA');
  const est = await call('POST', '/estimate', {
    body: { geometry: geo, finishLevel: 'standard' },
  });
  check('smeta hisoblandi', est.status === 200 && est.json.data.total > 0);
  check('kategoriyalarga bo\'lindi', est.json?.data?.categories?.length >= 4);
  check('ogohlantirish bor', Boolean(est.json?.data?.disclaimer));
  check('garaj smetaga tushdi', est.json?.data?.measurements?.GARAGE_AREA > 0);

  const premium = await call('POST', '/estimate', {
    body: { geometry: geo, finishLevel: 'premium' },
  });
  check('premium qimmatroq', premium.json?.data?.total > est.json?.data?.total);

  const cheaper = await call('POST', '/estimate', {
    body: {
      geometry: geo,
      finishLevel: 'standard',
      selection: { wall_exterior: { optionCode: 'sendvich' } },
    },
  });
  check('arzon material summani tushiradi', cheaper.json?.data?.total < est.json?.data?.total);
  check(
    'tanlov manbasi belgilandi',
    cheaper.json?.data?.lines?.find((l) => l.code === 'wall_exterior')?.source === 'option',
  );
  check('aniqlik oshdi', cheaper.json?.data?.confidence > est.json?.data?.confidence);

  const items = await call('GET', '/estimate/price-items');
  check('narx bandlari materiallari bilan', items.json?.data?.some((i) => i.options?.length >= 3));
  check('pardoz darajalari', (await call('GET', '/estimate/finish-levels')).json?.data?.length === 3);

  // -------------------------------------------------------------- PROJECTS
  section('6. LOYIHALAR');
  const created = await call('POST', '/projects', {
    body: {
      title: 'Tekshiruv loyihasi',
      params: PARAMS,
      geometry: geo,
      styleSlug: 'modern',
      
      finishLevel: 'standard',
    },
    token: admin,
  });
  check('loyiha saqlandi', created.status === 200, `(${created.status})`);

  const projectId = created.json?.data?.id;
  check('smeta saqlandi', Number(created.json?.data?.estimateTotal) > 0);
  check('muqova saqlandi', Boolean(created.json?.data?.coverSvg));

  check('ro\'yxat ishlaydi', (await call('GET', '/projects', { token: admin })).status === 200);
  check('bitta loyiha olish', (await call('GET', `/projects/${projectId}`, { token: admin })).status === 200);

  const updated = await call('PATCH', `/projects/${projectId}`, {
    body: { title: 'Yangi nom', geometry: added.json.data, versionLabel: 'xona qo\'shildi' },
    token: admin,
  });
  check('tahrirlash ishlaydi', updated.status === 200, `(${updated.status})`);

  const versions = await call('GET', `/projects/${projectId}/versions`, { token: admin });
  check('versiyalar yozildi', versions.status === 200 && versions.json.data.length >= 2, `(${versions.json?.data?.length})`);

  check('qayta hisoblash', (await call('POST', `/projects/${projectId}/recalculate`, { token: admin })).status === 200);
  check('yumshoq o\'chirish', (await call('DELETE', `/projects/${projectId}`, { token: admin })).status === 200);
  check('tiklash', (await call('POST', `/projects/${projectId}/restore`, { token: admin })).status === 200);

  const foreign = await call('GET', `/projects/${projectId}`, { token: userToken });
  check('begona loyiha yopiq', foreign.status === 403 || foreign.status === 404, `(${foreign.status})`);

  /*
    Admin ro'yxati.

    Eng muhim tekshiruv — oxirgisi: bu uch oddiy foydalanuvchiga
    OCHILMASLIGI kerak. `/projects/all` yo'li `/projects/:id` dan
    oldin turadi, ya'ni himoya buzilsa har kim hamma loyihani ko'rardi.
  */
  const allProjects = await call('GET', '/projects/all', { token: admin });
  check(
    'admin barcha loyihalarni ko\'radi',
    allProjects.status === 200 && allProjects.json?.data?.length > 0,
    `(${allProjects.status})`,
  );
  check(
    'admin ro\'yxatida egasi bor',
    Boolean(allProjects.json?.data?.[0]?.user?.email),
    JSON.stringify(allProjects.json?.data?.[0]?.user ?? null),
  );

  // Egasi bo'yicha qidiruv — admin ko'pincha shundan boshlaydi.
  const byOwner = await call('GET', '/projects/all?search=admin@archai.uz', { token: admin });
  check('egasi bo\'yicha qidiruv', byOwner.status === 200 && byOwner.json?.data?.length > 0, `(${byOwner.status})`);

  // Savatcha: o'chirilganlar alohida ko'rinadi.
  await call('DELETE', `/projects/${projectId}`, { token: admin });
  const trash = await call('GET', '/projects/all?deleted=only', { token: admin });
  check(
    'savatcha ko\'rinadi',
    trash.json?.data?.some((row) => row.id === projectId),
    `(${trash.status}, ${trash.json?.data?.length})`,
  );
  const active = await call('GET', '/projects/all?deleted=exclude', { token: admin });
  check('faol ro\'yxatda o\'chirilgani yo\'q', !active.json?.data?.some((row) => row.id === projectId));
  await call('POST', `/projects/${projectId}/restore`, { token: admin });

  check('admin ro\'yxati oddiy foydalanuvchiga yopiq', (await call('GET', '/projects/all', { token: userToken })).status === 403);
  check('admin ro\'yxati mehmonga yopiq', (await call('GET', '/projects/all')).status === 401);

  // --- Ulashish havolasi ----------------------------------------------------
  const shared = await call('POST', `/projects/${projectId}/share`, { token: admin });
  const shareToken = shared.json?.data?.token;
  check('ulashish havolasi yaratildi', shared.status === 200 && Boolean(shareToken), `(${shared.status})`);

  /*
    Qayta so'ralganda O'SHA token qaytishi kerak: aks holda har
    bosishda yuborilgan havola o'lardi va foydalanuvchi buni kutmasdi.
  */
  const again = await call('POST', `/projects/${projectId}/share`, { token: admin });
  check("takroriy so'rovda token o'zgarmaydi", again.json?.data?.token === shareToken);

  const publicView = await call('GET', `/projects/shared/${shareToken}`);
  check("mehmon ulashilganni ko'radi", publicView.status === 200, `(${publicView.status})`);
  check(
    'egasi oshkor qilinmaydi',
    !('user' in (publicView.json?.data ?? {})) && !('userId' in (publicView.json?.data ?? {})),
    JSON.stringify(Object.keys(publicView.json?.data ?? {})),
  );

  await call('DELETE', `/projects/${projectId}/share`, { token: admin });
  check("o'chirilgan havola ishlamaydi", (await call('GET', `/projects/shared/${shareToken}`)).status === 404);
  check('yaroqsiz token 404', (await call('GET', '/projects/shared/yoqbunday')).status === 404);

  // --- Mening narxlarim -----------------------------------------------------
  const profile = await call('POST', '/price-profiles', {
    body: { name: "Sinov to'plami", selection: { wall_exterior: { unitPrice: 500000 } } },
    token: userToken,
  });
  check("narx to'plami saqlandi", profile.status === 200, `(${profile.status})`);
  check("to'plamlar ro'yxati", (await call('GET', '/price-profiles', { token: userToken })).json?.data?.length > 0);
  check("to'plamlar mehmonga yopiq", (await call('GET', '/price-profiles')).status === 401);

  // Begona to'plamga tegib bo'lmasligi kerak.
  check(
    "begona to'plam ko'rinmaydi",
    (await call('DELETE', `/price-profiles/${profile.json?.data?.id}`, { token: admin })).status === 404,
  );
  check(
    "nomsiz to'plam rad etiladi",
    (await call('POST', '/price-profiles', { body: { name: '', selection: {} }, token: userToken })).status === 400,
  );

  await call('DELETE', `/price-profiles/${profile.json?.data?.id}`, { token: userToken });


  // Materiallar tanlovi: saqlanadi, summani o'zgartiradi va tarifdan
  // qat'i nazar ochiq bo'lishi kerak.
  const beforePick = Number((await call('GET', `/projects/${projectId}`, { token: admin })).json?.data?.estimateTotal);

  const picked = await call('PATCH', `/projects/${projectId}/estimate`, {
    body: { selection: { wall_exterior: { optionCode: 'sendvich' } } },
    token: admin,
  });
  check('tanlov saqlandi', picked.status === 200, `(${picked.status})`);
  check('tanlov summani tushirdi', Number(picked.json?.data?.estimateTotal) < beforePick);
  check(
    'tanlov loyihada qoldi',
    picked.json?.data?.estimateSelection?.wall_exterior?.optionCode === 'sendvich',
  );

  const withOwn = await call('PATCH', `/projects/${projectId}/estimate`, {
    body: { selection: { wall_exterior: { unitPrice: 100 } } },
    token: admin,
  });
  check(
    'o\'z narxi materialdan ustun',
    withOwn.json?.data?.estimate?.lines?.find((l) => l.code === 'wall_exterior')?.unitPrice === 100,
  );

  const excluded = await call('PATCH', `/projects/${projectId}/estimate`, {
    body: { selection: { wall_exterior: { excluded: true } } },
    token: admin,
  });
  check(
    'chiqarilgan band smetada yo\'q',
    !excluded.json?.data?.estimate?.lines?.some((l) => l.code === 'wall_exterior'),
  );

  // Tanlov versiya yaratmasligi kerak — geometriya o'zgarmadi.
  const afterSelection = await call('GET', `/projects/${projectId}/versions`, { token: admin });
  check(
    'tanlov versiya yaratmaydi',
    afterSelection.json?.data?.length === versions.json?.data?.length,
    `(${afterSelection.json?.data?.length} / ${versions.json?.data?.length})`,
  );

  // Bepul tarifdagi foydalanuvchi geometriyani saqlay olmaydi, lekin
  // narxni aniqlashtira olishi kerak — bu ataylab shunday.
  const ownProject = await call('POST', '/projects', {
    body: { title: 'Bepul tarif', params: PARAMS, geometry: geo, finishLevel: 'standard' },
    token: userToken,
  });
  const ownId = ownProject.json?.data?.id;

  const freeGeometry = await call('PATCH', `/projects/${ownId}`, {
    body: { title: 'Boshqa nom' },
    token: userToken,
  });
  const freeSelection = await call('PATCH', `/projects/${ownId}/estimate`, {
    body: { selection: { wall_exterior: { unitPrice: 500_000 } } },
    token: userToken,
  });
  check(
    'bepul tarifda narx tahriri ochiq',
    freeSelection.status === 200,
    `(narx ${freeSelection.status}, geometriya ${freeGeometry.status})`,
  );

  await call('DELETE', `/projects/${ownId}`, { token: userToken });

  // ------------------------------------------------------------ PLAN LIMIT
  section('7. TARIF LIMITLARI');
  const first = await call('POST', '/projects', {
    body: { title: 'Free 1', params: PARAMS, geometry: geo },
    token: userToken,
  });
  check('free: 1-loyiha ruxsat', first.status === 200, `(${first.status})`);

  const second = await call('POST', '/projects', {
    body: { title: 'Free 2', params: PARAMS, geometry: geo },
    token: userToken,
  });
  check(
    'free: 2-loyiha rad etiladi',
    second.status === 403 && second.json?.code === 'PLAN_LIMIT',
    `(${second.status} ${second.json?.code})`,
  );
  check('limit ma\'lumoti keladi', second.json?.meta?.plan === 'free' && second.json?.meta?.limit === 1);

  const pdfFree = await call('POST', `/projects/${first.json?.data?.id}/pdf`, { token: userToken });
  check('free: PDF rad etiladi', pdfFree.status === 403, `(${pdfFree.status})`);

  // --------------------------------------------------------------- BILLING
  section('8. TO\'LOV');
  const plans = await call('GET', '/billing/plans');
  check('tariflar (3 ta)', plans.status === 200 && plans.json.data.length === 3);
  check('obuna holati', (await call('GET', '/billing/subscription', { token: userToken })).status === 200);

  const providers = await call('GET', '/billing/providers');
  check('provayderlar holati', providers.status === 200 && providers.json.data.length === 3);

  /**
   * Sozlangan provayder to'lov havolasini berishi, sozlanmagani esa aniq
   * xato qaytarishi kerak. Ikkinchisi muhimroq: buzuq havola bergandan
   * ko'ra ochiq "sozlanmagan" deyish yaxshi.
   */
  for (const entry of providers.json.data) {
    const checkout = await call('POST', '/billing/checkout', {
      body: { planCode: 'basic', provider: entry.code, months: 1 },
      token: userToken,
    });

    if (entry.ready) {
      check(
        `checkout: ${entry.code} (sozlangan)`,
        checkout.status === 200 && Boolean(checkout.json?.data?.redirectUrl),
        `(${checkout.status})`,
      );
    } else {
      check(
        `checkout: ${entry.code} sozlanmagan → 400`,
        checkout.status === 400,
        `(${checkout.status})`,
      );
    }
  }

  const freeCheckout = await call('POST', '/billing/checkout', {
    body: { planCode: 'free', provider: 'CLICK' },
    token: userToken,
  });
  check('bepul tarifga to\'lov rad etiladi', freeCheckout.status === 400, `(${freeCheckout.status})`);

  // -------------------------------------------------------------- WEBHOOKS
  section('9. WEBHOOKLAR');
  const paymeNoAuth = await call('POST', '/webhook/payme', {
    body: { method: 'CheckPerformTransaction', params: {}, id: 1 },
  });
  check('payme: kalitsiz rad etiladi', paymeNoAuth.json?.error?.code === -32504, `(${paymeNoAuth.json?.error?.code})`);

  const clickBadSign = await call('POST', '/webhook/click', {
    body: {
      click_trans_id: '1',
      service_id: '1',
      merchant_trans_id: 'x',
      amount: 100,
      action: 0,
      sign_time: '2026-01-01 00:00:00',
      sign_string: 'yomon',
    },
  });
  check('click: imzo tekshiriladi', clickBadSign.json?.error === -1, `(${clickBadSign.json?.error})`);

  const stripeNoSig = await call('POST', '/webhook/stripe', { body: '{}', raw: true });
  check('stripe: imzosiz rad etiladi', stripeNoSig.status === 400, `(${stripeNoSig.status})`);

  // ---------------------------------------------------- PAYME: TO'LIQ SIKL
  const paymeSecret = process.env.PAYME_SECRET_KEY;

  if (!paymeSecret) {
    console.log("    diqqat: PAYME_SECRET_KEY sozlanmagan — to'liq sikl sinalmadi");
  } else {
    const paymeAuth = paymeBasicAuth(paymeSecret);
    const paymeBadAuth = paymeBasicAuth('notogri-kalit');

    /*
      `id` here is the Payme transaction id — it belongs inside `params`
      (that's what `payme.service.ts` reads to look up the transaction),
      not just the outer JSON-RPC envelope. `CheckPerformTransaction`
      ignores it since no transaction exists yet, so injecting it
      unconditionally is harmless there.
    */
    const paymeRpc = (id, method, params, auth = paymeAuth) =>
      callWithHeaders('POST', '/webhook/payme', {
        body: { method, params: { id, ...params }, id },
        headers: { Authorization: auth },
      });

    const paymeCheckout = await call('POST', '/billing/checkout', {
      body: { planCode: 'basic', provider: 'PAYME', months: 1 },
      token: userToken,
    });
    const paymeSubId = paymeCheckout.json?.data?.subscriptionId;
    const paymeAmountTiyin = Math.round((paymeCheckout.json?.data?.amount ?? 0) * 100);
    const paymeExternalId = `verify-payme-${Date.now()}`;
    const account = { subscription_id: paymeSubId };

    const checkOk = await paymeRpc(paymeExternalId, 'CheckPerformTransaction', {
      amount: paymeAmountTiyin,
      account,
    });
    check("payme: to'g'ri so'rov ruxsat beradi", checkOk.json?.result?.allow === true, JSON.stringify(checkOk.json));

    const checkBadAuth = await paymeRpc(
      paymeExternalId,
      'CheckPerformTransaction',
      { amount: paymeAmountTiyin, account },
      paymeBadAuth,
    );
    check(
      "payme: noto'g'ri kalit rad etiladi",
      checkBadAuth.json?.error?.code === -32504,
      `(${checkBadAuth.json?.error?.code})`,
    );

    const checkBadAmount = await paymeRpc(paymeExternalId, 'CheckPerformTransaction', {
      amount: paymeAmountTiyin + 1,
      account,
    });
    check(
      "payme: noto'g'ri summa rad etiladi",
      checkBadAmount.json?.error?.code === -31001,
      `(${checkBadAmount.json?.error?.code})`,
    );

    const checkNoSub = await paymeRpc(paymeExternalId, 'CheckPerformTransaction', {
      amount: paymeAmountTiyin,
      account: { subscription_id: 'yoq-bunday-obuna' },
    });
    check(
      "payme: mavjud bo'lmagan obuna rad etiladi",
      checkNoSub.json?.error?.code === -31050,
      `(${checkNoSub.json?.error?.code})`,
    );

    const created = await paymeRpc(paymeExternalId, 'CreateTransaction', {
      time: Date.now(),
      amount: paymeAmountTiyin,
      account,
    });
    check("payme: tranzaksiya yaratildi", created.json?.result?.state === 1, JSON.stringify(created.json));

    const createdAgain = await paymeRpc(paymeExternalId, 'CreateTransaction', {
      time: Date.now(),
      amount: paymeAmountTiyin,
      account,
    });
    check(
      'payme: takroriy yaratish idempotent (yangisi ochilmaydi)',
      createdAgain.json?.result?.transaction === created.json?.result?.transaction,
      `(${createdAgain.json?.result?.transaction} vs ${created.json?.result?.transaction})`,
    );

    const performed = await paymeRpc(paymeExternalId, 'PerformTransaction', {});
    check("payme: to'lov amalga oshdi", performed.json?.result?.state === 2, JSON.stringify(performed.json));

    const afterPerform = await call('GET', '/billing/subscription', { token: userToken });
    check(
      'payme: obuna faollashdi',
      afterPerform.json?.data?.subscription?.status === 'ACTIVE',
      JSON.stringify(afterPerform.json?.data?.subscription),
    );

    const performedAgain = await paymeRpc(paymeExternalId, 'PerformTransaction', {});
    check(
      "payme: takroriy amalga oshirish idempotent (qayta faollashtirmaydi)",
      performedAgain.json?.result?.state === 2 &&
        performedAgain.json?.result?.perform_time === performed.json?.result?.perform_time,
      `(${performedAgain.json?.result?.perform_time} vs ${performed.json?.result?.perform_time})`,
    );

    const checkAlreadyActive = await paymeRpc(`${paymeExternalId}-active`, 'CheckPerformTransaction', {
      amount: paymeAmountTiyin,
      account,
    });
    check(
      "payme: allaqachon faol obunaga yangi to'lov rad etiladi",
      checkAlreadyActive.json?.error?.code === -31008,
      `(${checkAlreadyActive.json?.error?.code})`,
    );

    const cancelled = await paymeRpc(paymeExternalId, 'CancelTransaction', { reason: 1 });
    check(
      "payme: to'lovdan keyin bekor qilinadi (qaytarish)",
      cancelled.json?.result?.state === -2,
      JSON.stringify(cancelled.json),
    );

    const afterCancel = await call('GET', '/billing/subscription', { token: userToken });
    check(
      "payme: bekor qilingandan keyin obuna faol emas",
      !afterCancel.json?.data?.subscription,
      JSON.stringify(afterCancel.json?.data?.subscription),
    );

    const cancelledAgain = await paymeRpc(paymeExternalId, 'CancelTransaction', { reason: 1 });
    check(
      'payme: takroriy bekor qilish idempotent',
      cancelledAgain.json?.result?.state === -2 &&
        cancelledAgain.json?.result?.cancel_time === cancelled.json?.result?.cancel_time,
      `(${cancelledAgain.json?.result?.cancel_time} vs ${cancelled.json?.result?.cancel_time})`,
    );

    const unknownPerform = await paymeRpc(`yoq-${Date.now()}`, 'PerformTransaction', {});
    check(
      "payme: mavjud bo'lmagan tranzaksiya topilmadi",
      unknownPerform.json?.error?.code === -31003,
      `(${unknownPerform.json?.error?.code})`,
    );

    // ---- bir vaqtda ikki chaqiruv: @@unique([provider, externalId]) ishlaydimi ----
    const raceCheckout = await call('POST', '/billing/checkout', {
      body: { planCode: 'basic', provider: 'PAYME', months: 1 },
      token: userToken,
    });
    const raceSubId = raceCheckout.json?.data?.subscriptionId;
    const raceAmountTiyin = Math.round((raceCheckout.json?.data?.amount ?? 0) * 100);
    const raceExternalId = `verify-payme-race-${Date.now()}`;
    const raceParams = {
      time: Date.now(),
      amount: raceAmountTiyin,
      account: { subscription_id: raceSubId },
    };

    const [raceA, raceB] = await Promise.all([
      paymeRpc(raceExternalId, 'CreateTransaction', raceParams),
      paymeRpc(raceExternalId, 'CreateTransaction', raceParams),
    ]);
    check(
      'payme: bir vaqtda ikki CreateTransaction bitta tranzaksiya beradi',
      Boolean(raceA.json?.result?.transaction) &&
        raceA.json?.result?.transaction === raceB.json?.result?.transaction,
      `(${raceA.json?.result?.transaction} vs ${raceB.json?.result?.transaction})`,
    );

    // Tozalash: yarim ochiq qolgan race tranzaksiyasini bekor qilamiz.
    await paymeRpc(raceExternalId, 'CancelTransaction', { reason: 1 });
  }

  // ---------------------------------------------------- CLICK: TO'LIQ SIKL
  const clickSecret = process.env.CLICK_SECRET_KEY;
  const clickServiceId = process.env.CLICK_SERVICE_ID;

  if (!clickSecret) {
    console.log("    diqqat: CLICK_SECRET_KEY sozlanmagan — to'liq sikl sinalmadi");
  } else {
    const clickCheckout = await call('POST', '/billing/checkout', {
      body: { planCode: 'basic', provider: 'CLICK', months: 1 },
      token: userToken,
    });
    const clickSubId = clickCheckout.json?.data?.subscriptionId;
    const clickAmount = clickCheckout.json?.data?.amount ?? 0;
    const clickTransId = `verify-click-${Date.now()}`;
    const signTime = new Date().toISOString().slice(0, 19).replace('T', ' ');
    const sign = (fields) => clickSignature({ serviceId: clickServiceId, secretKey: clickSecret, signTime, ...fields });

    const prepareSign = sign({ clickTransId, merchantTransId: clickSubId, amount: clickAmount, action: 0 });
    const prepare = await callWithHeaders('POST', '/webhook/click', {
      body: {
        click_trans_id: clickTransId,
        service_id: clickServiceId,
        merchant_trans_id: clickSubId,
        amount: clickAmount,
        action: 0,
        sign_time: signTime,
        sign_string: prepareSign,
      },
    });
    check(
      "click: to'g'ri prepare qabul qilinadi",
      prepare.json?.error === 0 && prepare.json?.merchant_prepare_id === clickTransId,
      JSON.stringify(prepare.json),
    );

    const prepareBadSign = await callWithHeaders('POST', '/webhook/click', {
      body: {
        click_trans_id: clickTransId,
        service_id: clickServiceId,
        merchant_trans_id: clickSubId,
        amount: clickAmount,
        action: 0,
        sign_time: signTime,
        sign_string: 'yomon-imzo',
      },
    });
    check("click: noto'g'ri imzo rad etiladi", prepareBadSign.json?.error === -1, `(${prepareBadSign.json?.error})`);

    const wrongAmount = clickAmount + 1000;
    const wrongAmountTransId = `${clickTransId}-wrong-amount`;
    const wrongAmountSign = sign({
      clickTransId: wrongAmountTransId,
      merchantTransId: clickSubId,
      amount: wrongAmount,
      action: 0,
    });
    const prepareWrongAmount = await callWithHeaders('POST', '/webhook/click', {
      body: {
        click_trans_id: wrongAmountTransId,
        service_id: clickServiceId,
        merchant_trans_id: clickSubId,
        amount: wrongAmount,
        action: 0,
        sign_time: signTime,
        sign_string: wrongAmountSign,
      },
    });
    check(
      "click: noto'g'ri summa rad etiladi",
      prepareWrongAmount.json?.error === -2,
      `(${prepareWrongAmount.json?.error})`,
    );

    const noSubTransId = `${clickTransId}-no-sub`;
    const noSubSign = sign({
      clickTransId: noSubTransId,
      merchantTransId: 'yoq-bunday-obuna',
      amount: clickAmount,
      action: 0,
    });
    const prepareNoSub = await callWithHeaders('POST', '/webhook/click', {
      body: {
        click_trans_id: noSubTransId,
        service_id: clickServiceId,
        merchant_trans_id: 'yoq-bunday-obuna',
        amount: clickAmount,
        action: 0,
        sign_time: signTime,
        sign_string: noSubSign,
      },
    });
    check(
      "click: mavjud bo'lmagan obuna rad etiladi",
      prepareNoSub.json?.error === -5,
      `(${prepareNoSub.json?.error})`,
    );

    const completeSign = sign({
      clickTransId,
      merchantTransId: clickSubId,
      merchantPrepareId: clickTransId,
      amount: clickAmount,
      action: 1,
    });
    const completeBody = {
      click_trans_id: clickTransId,
      service_id: clickServiceId,
      merchant_trans_id: clickSubId,
      merchant_prepare_id: clickTransId,
      amount: clickAmount,
      action: 1,
      sign_time: signTime,
      sign_string: completeSign,
    };
    const complete = await callWithHeaders('POST', '/webhook/click', { body: completeBody });
    check(
      'click: complete faollashtiradi',
      complete.json?.error === 0 && Boolean(complete.json?.merchant_confirm_id),
      JSON.stringify(complete.json),
    );

    const afterClickComplete = await call('GET', '/billing/subscription', { token: userToken });
    check(
      'click: obuna faollashdi',
      afterClickComplete.json?.data?.subscription?.status === 'ACTIVE',
      JSON.stringify(afterClickComplete.json?.data?.subscription),
    );
    const periodEndFirst = afterClickComplete.json?.data?.subscription?.periodEnd;

    const completeAgain = await callWithHeaders('POST', '/webhook/click', { body: completeBody });
    check('click: takroriy complete idempotent', completeAgain.json?.error === 0, `(${completeAgain.json?.error})`);

    const afterSecondComplete = await call('GET', '/billing/subscription', { token: userToken });
    check(
      'click: takroriy complete obunani qayta faollashtirmadi',
      afterSecondComplete.json?.data?.subscription?.periodEnd === periodEndFirst,
      `(${afterSecondComplete.json?.data?.subscription?.periodEnd} vs ${periodEndFirst})`,
    );

    const activeTransId = `${clickTransId}-active`;
    const activeSign = sign({ clickTransId: activeTransId, merchantTransId: clickSubId, amount: clickAmount, action: 0 });
    const prepareOnActive = await callWithHeaders('POST', '/webhook/click', {
      body: {
        click_trans_id: activeTransId,
        service_id: clickServiceId,
        merchant_trans_id: clickSubId,
        amount: clickAmount,
        action: 0,
        sign_time: signTime,
        sign_string: activeSign,
      },
    });
    check(
      "click: allaqachon faol obunaga prepare rad etiladi",
      prepareOnActive.json?.error === -4,
      `(${prepareOnActive.json?.error})`,
    );

    const unknownId = `yoq-${Date.now()}`;
    const unknownSign = sign({
      clickTransId: unknownId,
      merchantTransId: clickSubId,
      merchantPrepareId: unknownId,
      amount: clickAmount,
      action: 1,
    });
    const unknownComplete = await callWithHeaders('POST', '/webhook/click', {
      body: {
        click_trans_id: unknownId,
        service_id: clickServiceId,
        merchant_trans_id: clickSubId,
        merchant_prepare_id: unknownId,
        amount: clickAmount,
        action: 1,
        sign_time: signTime,
        sign_string: unknownSign,
      },
    });
    check(
      "click: mavjud bo'lmagan tranzaksiya topilmadi",
      unknownComplete.json?.error === -6,
      `(${unknownComplete.json?.error})`,
    );

    const clickCancel = await callWithHeaders('POST', '/webhook/click', {
      body: { ...completeBody, error: -1 },
    });
    check(
      "click: to'lovdan keyin bekor qilinadi (qaytarish)",
      clickCancel.json?.error === -9,
      JSON.stringify(clickCancel.json),
    );

    const afterClickCancel = await call('GET', '/billing/subscription', { token: userToken });
    check(
      "click: bekor qilingandan keyin obuna faol emas",
      !afterClickCancel.json?.data?.subscription,
      JSON.stringify(afterClickCancel.json?.data?.subscription),
    );

    const completeAfterCancel = await callWithHeaders('POST', '/webhook/click', { body: completeBody });
    check(
      "click: bekor qilingan tranzaksiyani complete qilib bo'lmaydi",
      completeAfterCancel.json?.error === -9,
      `(${completeAfterCancel.json?.error})`,
    );
  }

  // ---------------------------------------------------- STRIPE: IMZO SINOVI
  const stripeWebhookSecret = process.env.STRIPE_WEBHOOK_SECRET;

  if (stripeWebhookSecret) {
    /*
      STRIPE_SECRET_KEY ataylab sozlanmagan (haqiqiy Stripe kaliti yo'q —
      qo'ysak /billing/providers uni "tayyor" deb ko'rsatib, yuqoridagi
      checkout sinovi Stripe'ning haqiqiy API'siga soxta kalit bilan
      murojaat qilib yiqilardi). Shuning uchun imzo TO'LIQ qabul qilinishi
      (obuna faollashishi) shu muhitda sinalmaydi — faqat soxta/yaroqsiz
      holatlar hech qachon muvaffaqiyat yoki halokatga olib kelmasligi
      tekshiriladi.
    */
    const payload = JSON.stringify({ id: 'evt_verify_test', type: 'checkout.session.completed' });
    const timestamp = Math.floor(Date.now() / 1000);
    const forgedSig = require('node:crypto')
      .createHmac('sha256', 'notogri-webhook-secret')
      .update(`${timestamp}.${payload}`)
      .digest('hex');

    const stripeForged = await callWithHeaders('POST', '/webhook/stripe', {
      body: payload,
      raw: true,
      headers: { 'stripe-signature': `t=${timestamp},v1=${forgedSig}` },
    });
    check(
      "stripe: soxta imzo hech qachon qabul qilinmaydi",
      stripeForged.status === 400,
      `(${stripeForged.status})`,
    );

    console.log(
      "    diqqat: STRIPE_SECRET_KEY sozlanmagan (haqiqiy API kaliti yo'q) — to'liq qabul qilish sikli sinalmadi",
    );
  }

  // ------------------------------------------------------- BLOG / FAQ / LEAD
  section('10. BLOG / FAQ / SO\'ROVLAR');
  const category = await call('POST', '/blog/categories', {
    body: { slug: `cat-${Date.now()}`, name: { uz: 'Maslahatlar' } },
    token: admin,
  });
  check('kategoriya yaratildi', category.status === 200, `(${category.status})`);

  const slug = `maqola-${Date.now()}`;
  const post = await call('POST', '/blog', {
    body: {
      slug,
      title: { uz: 'Sinov maqola' },
      body: { type: 'doc', content: [] },
      status: 'PUBLISHED',
      categoryId: category.json?.data?.id,
    },
    token: admin,
  });
  check('maqola yaratildi', post.status === 200, `(${post.status})`);
  check('maqolalar ro\'yxati', (await call('GET', '/blog')).json?.data?.length > 0);
  check('maqola slug bo\'yicha', (await call('GET', `/blog/${slug}`)).status === 200);

  const draft = await call('POST', '/blog', {
    body: { slug: `qoralama-${Date.now()}`, title: { uz: 'Qoralama' }, body: {}, status: 'DRAFT' },
    token: admin,
  });
  const draftPublic = await call('GET', `/blog/${draft.json?.data?.slug}`);
  check('qoralama mehmonga ko\'rinmaydi', draftPublic.status === 404, `(${draftPublic.status})`);

  const faq = await call('POST', '/faq', {
    body: { category: 'sinov', question: { uz: 'Savol?' }, answer: { uz: 'Javob.' } },
    token: admin,
  });
  check('FAQ qo\'shildi', faq.status === 200, `(${faq.status})`);

  const faqs = await call('GET', '/faq');
  check('FAQ guruhlangan', faqs.status === 200 && Boolean(faqs.json?.data?.[0]?.questions));

  const lead = await call('POST', '/leads', {
    body: { name: 'Test Mijoz', phone: '+998901234567', message: 'Salom', source: 'no-match' },
  });
  check('so\'rov yuborildi', lead.status === 200, `(${lead.status})`);
  check('so\'rovlar ro\'yxati (admin)', (await call('GET', '/leads', { token: admin })).json?.data?.length > 0);
  check('so\'rovlar mehmonga yopiq', (await call('GET', '/leads')).status === 401);

  /*
    O'zidan keyin tozalaydi.

    Ilgari tozalanmasdi va har yurish bazaga ikkita maqola, bitta savol
    va bitta murojaat qo'shardi — ochiq blog sahifasida 80 ta "Sinov
    maqola" yig'ilib qolgan edi. Bundan tashqari yig'ilib qolgan
    ma'lumot boshqa tekshiruvlarni ham buzadi: aniq songa tayangan
    bandlar ("uslublar (4 ta)") bir kun yiqiladi.
  */
  for (const id of [post.json?.data?.id, draft.json?.data?.id]) {
    if (id) await call('DELETE', `/blog/${id}`, { token: admin });
  }
  if (category.json?.data?.id) {
    await call('DELETE', `/blog/categories/${category.json.data.id}`, { token: admin });
  }
  if (faq.json?.data?.id) await call('DELETE', `/faq/${faq.json.data.id}`, { token: admin });
  if (lead.json?.data?.id) await call('DELETE', `/leads/${lead.json.data.id}`, { token: admin });

  // Tozalash HAQIQATAN ishlaganini ham tekshiramiz — jimgina o'tib
  // ketgan `DELETE` yana yig'ilishga olib kelardi.
  check('sinov maqolasi o\'chirildi', (await call('GET', `/blog/${slug}`)).status === 404);

  // ----------------------------------------------------------------- MEDIA
  section('11. MEDIA');
  const mediaList = await call('GET', '/s3/media', { token: admin });
  check('media ro\'yxati (admin)', mediaList.status === 200);
  check('media mehmonga yopiq', (await call('GET', '/s3/media')).status === 401);

  // Tur bo'yicha filtr va sahifalash — admin ekrani shularga tayanadi.
  const byType = await call('GET', '/s3/media?type=IMAGE&limit=5', { token: admin });
  check('media turi bo\'yicha filtr', byType.status === 200 && (byType.json?.data?.length ?? 0) <= 5, `(${byType.status})`);
  check(
    'media ro\'yxatida yuklagan odam bor',
    // Bo'sh ro'yxat ham to'g'ri holat — shunda tekshiradigan narsa yo'q.
    (mediaList.json?.data ?? []).every((row) => 'uploader' in row),
    JSON.stringify(Object.keys(mediaList.json?.data?.[0] ?? {})),
  );

  /*
    Yetim fayllar.

    Hisob bir necha jadvalni ko'zdan kechiradi, ya'ni uch ishlashini
    tekshirish arzon emas — lekin uni umuman chaqirmaslik yomonroq:
    `purgeOrphans` fayllarni BUTUNLAY o'chiradi va noto'g'ri hisob
    ishlatilayotgan faylni olib ketardi.
  */
  const orphans = await call('GET', '/s3/media/orphans?days=7', { token: admin });
  check('yetim fayllar hisoblanadi', orphans.status === 200 && Array.isArray(orphans.json?.data), `(${orphans.status})`);
  check('yetim fayllar mehmonga yopiq', (await call('GET', '/s3/media/orphans')).status === 401);
  check('yetimlarni tozalash mehmonga yopiq', (await call('DELETE', '/s3/media/orphans')).status === 401);
  check('yetimlarni tozalash oddiy foydalanuvchiga yopiq', (await call('DELETE', '/s3/media/orphans', { token: userToken })).status === 403);

  // --- Loyiha eksportlari ---------------------------------------------------
  /*
    PDF va 3D rasmlar `media` da EMAS, `project_exports` da yotadi —
    ular kesh va muddati o'tgach o'zi o'chadi. Admin ularni alohida
    bo'limda ko'radi.
  */
  const exportsList = await call('GET', '/exports', { token: admin });
  check("eksportlar ro'yxati", exportsList.status === 200, `(${exportsList.status})`);
  check(
    'jami hajm hisoblanadi',
    typeof exportsList.json?.meta?.bytes === 'number',
    JSON.stringify(exportsList.json?.meta),
  );
  check(
    "loyiha va egasi ko'rsatiladi",
    exportsList.json?.data?.length === 0 ||
      Boolean(exportsList.json?.data?.[0]?.project),
    JSON.stringify(Object.keys(exportsList.json?.data?.[0] ?? {})),
  );
  check('eksportlar mehmonga yopiq', (await call('GET', '/exports')).status === 401);
  check(
    'eksportlar oddiy foydalanuvchiga yopiq',
    (await call('GET', '/exports', { token: userToken })).status === 403,
  );
  check(
    "tur bo'yicha filtr",
    (await call('GET', '/exports?kind=RENDER', { token: admin })).status === 200,
  );

  // --- Fayl yuklash ---------------------------------------------------------
  /*
    Yuklash uchi qurilgan edi, lekin UI'da vidjet yo'q edi va uch
    o'zi ham S3 sozlanmagan bo'lsa har doim rad etardi. Endi mahalliy
    diskka ham yozadi — shuning uchun bu yerda haqiqiy fayl yuboriladi.
  */
  const PIXEL = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==',
    'base64',
  );

  const uploadFile = (folder, token, { type = 'image/png', name = 'px.png' } = {}) => {
    const form = new FormData();
    form.append('file', new Blob([PIXEL], { type }), name);
    return call('POST', `/s3/${folder}/upload`, { token, body: form, raw: true });
  };

  const uploaded = [];

  const blogUpload = await uploadFile('blog', admin);
  check('admin rasm yuklaydi', blogUpload.status === 200 && Boolean(blogUpload.json?.data?.url), `(${blogUpload.status})`);
  if (blogUpload.json?.data?.id) uploaded.push(blogUpload.json.data.id);

  const avatarUpload = await uploadFile('avatar', userToken);
  check('oddiy foydalanuvchi avatar yuklaydi', avatarUpload.status === 200, `(${avatarUpload.status})`);
  if (avatarUpload.json?.data?.id) uploaded.push(avatarUpload.json.data.id);

  check(
    'oddiy foydalanuvchi blogga yuklay olmaydi',
    (await uploadFile('blog', userToken)).status === 403,
  );
  check('yuklash mehmonga yopiq', (await uploadFile('blog')).status === 401);
  check(
    "rasm bo'lmagan fayl rad etiladi",
    (await uploadFile('blog', admin, { type: 'text/plain', name: 'a.txt' })).status === 400,
  );
  check("noma'lum papkaga yuklab bo'lmaydi", (await uploadFile('hack', admin)).status === 400);

  /*
    Yuklangan fayl haqiqatan o'qiladimi. `/s3/file/*` imzolangan
    havolaga yo'naltiradi, shuning uchun yakuniy javob kutiladi.
  */
  if (blogUpload.json?.data?.url) {
    const fetched = await fetch(blogUpload.json.data.url, { redirect: 'follow' });
    check('yuklangan fayl ochiladi', fetched.ok, `(${fetched.status})`);
  }

  // Sinovdan keyin o'zidan keyin tozalaydi.
  for (const id of uploaded) await call('DELETE', `/s3/media/${id}`, { token: admin });

  const policy = await call('GET', '/s3/generate-policy?folder=blog&contentType=image/png&filename=a.png', {
    token: admin,
  });
  check('S3 sozlanmagan → 400', policy.status === 400, `(${policy.status})`);

  const badFolder = await call('GET', '/s3/generate-policy?folder=hack&contentType=image/png&filename=a.png', {
    token: admin,
  });
  check('noto\'g\'ri papka rad etiladi', badFolder.status === 400, `(${badFolder.status})`);

  const traversal = await call('GET', '/s3/file/blog/../../etc/passwd');
  check('yo\'l bo\'ylab chiqishga yo\'l yo\'q', traversal.status === 404 || traversal.status === 400, `(${traversal.status})`);

  // ----------------------------------------------------------------- HEALTH
  section('12. SOG\'LIQ');
  const health = await call('GET', '/health');
  check('yengil tekshiruv', health.status === 200 && health.json.status === 'ok');

  const ready = await call('GET', '/health/ready');
  check('chuqur tekshiruv', ready.status === 200 && Boolean(ready.json?.checks?.database));
  check('baza sog\'lom', ready.json?.checks?.database?.ok === true);

  // ------------------------------------------------------------ ADMIN PANEL
  section('13. ADMIN PANEL');

  check('audit mehmonga yopiq', (await call('GET', '/audit')).status === 401);
  check('tariflar mehmonga yopiq', (await call('GET', '/plans')).status === 401);
  check(
    'audit oddiy foydalanuvchiga yopiq',
    (await call('GET', '/audit', { token: userToken })).status === 403,
    `(${(await call('GET', '/audit', { token: userToken })).status})`,
  );

  const auditLog = await call('GET', '/audit', { token: admin });
  check('jurnal o\'qildi', auditLog.status === 200, `(${auditLog.status})`);
  check('yozuvlar bor', auditLog.json?.data?.length > 0, `(${auditLog.json?.data?.length})`);
  check(
    'ijrochi qo\'shildi',
    auditLog.json?.data?.some((row) => row.actor?.email),
  );
  check(
    'farq yozilgan',
    auditLog.json?.data?.some((row) => row.diff && Object.keys(row.diff).length > 0),
  );

  const facets = await call('GET', '/audit/facets', { token: admin });
  check('filtr qiymatlari', facets.json?.data?.entities?.length > 0);

  const filtered = await call('GET', '/audit?entity=price_item', { token: admin });
  check(
    'filtr ishlaydi',
    filtered.json?.data?.every((row) => row.entity === 'price_item'),
    `(${filtered.json?.data?.length})`,
  );

  // --- Tariflar ------------------------------------------------------------
  const adminPlans = await call('GET', '/plans', { token: admin });
  check('tariflar ro\'yxati', adminPlans.status === 200 && adminPlans.json.data.length === 3);
  check(
    'obunachilar soni qo\'shildi',
    adminPlans.json?.data?.every((row) => typeof row._count?.subscriptions === 'number'),
  );

  const startPlan = adminPlans.json?.data?.find((row) => row.code === 'pro');
  const planUpdate = await call('PUT', `/plans/${startPlan?.id}`, {
    body: { priceUzs: 199_000 },
    token: admin,
  });
  check('tarif narxi o\'zgardi', planUpdate.status === 200, `(${planUpdate.status})`);
  check('yangi narx qaytdi', Number(planUpdate.json?.data?.priceUzs) === 199_000);

  const badLimits = await call('PUT', `/plans/${startPlan?.id}`, {
    // `variants` yo'q — chala `limits` `plan.middleware.ts` da jimgina
    // `undefined` berardi.
    body: { limits: { projects: 5 } },
    token: admin,
  });
  check('chala chegaralar rad etiladi', badLimits.status === 400, `(${badLimits.status})`);

  // Narxni qaytaramiz.
  await call('PUT', `/plans/${startPlan?.id}`, {
    body: { priceUzs: Number(startPlan.priceUzs) },
    token: admin,
  });

  check(
    'tarif o\'zgarishi jurnalga tushdi',
    (await call('GET', '/audit?entity=plan', { token: admin })).json?.data?.length > 0,
  );

  const subs = await call('GET', '/plans/subscriptions', { token: admin });
  check('obunalar ro\'yxati', subs.status === 200, `(${subs.status})`);

  // --- Foydalanuvchilar ----------------------------------------------------
  const userList = await call('GET', '/users/paginated', { token: admin });
  check('foydalanuvchilar ro\'yxati', userList.status === 200 && userList.json.data.items.length > 0);
  check('foydalanuvchilar mehmonga yopiq', (await call('GET', '/users/paginated')).status === 401);

  // --- FAQ tartibi ---------------------------------------------------------
  /*
    Bu uch ilgari HECH QACHON ishlamagan.

    Tana yuqori darajadagi massiv edi va Ts.ED uni `@BodyParams()` ga
    bermasdi — "Value must be object" bilan 400 qaytarardi. Quyidagi
    ikki tekshiruv 400 kutgani uchun yashil turardi, ya'ni Zod
    chegaralari umuman sinalmagan edi. Shuning uchun endi MUSBAT
    tekshiruv birinchi turadi.
  */
  const faqList = await call('GET', '/faq', { token: admin });
  const faqItems = (faqList.json?.data ?? []).flatMap((group) => group.questions).slice(0, 2);

  const goodReorder = await call('PUT', '/faq/reorder', {
    body: { items: faqItems.map((item) => ({ id: item.id, sort: item.sort })) },
    token: admin,
  });
  check("to'g'ri tartib qabul qilinadi", goodReorder.status === 200, `(${goodReorder.status})`);

  const badReorder = await call('PUT', '/faq/reorder', {
    body: { items: [{ id: 'x' }] },
    token: admin,
  });
  check('buzuq tartib rad etiladi', badReorder.status === 400, `(${badReorder.status})`);

  const hugeReorder = await call('PUT', '/faq/reorder', {
    body: { items: Array.from({ length: 300 }, (_, index) => ({ id: `id${index}`, sort: index })) },
    token: admin,
  });
  check('juda katta massiv rad etiladi', hugeReorder.status === 400, `(${hugeReorder.status})`);

  // --- Blog sahifalash ------------------------------------------------------
  /*
    `?page=2` ilgari 400 qaytarardi: so'rov parametrlari satr bo'lib
    keladi, sxema esa son kutardi. Birinchi sahifa `default` bilan
    ishlagani uchun buni hech kim sezmagan.
  */
  const blogPage = await call('GET', '/blog?page=1&limit=5');
  check('blog sahifalash ishlaydi', blogPage.status === 200, `(${blogPage.status})`);
  check(
    'blog limiti hurmat qilinadi',
    (blogPage.json?.data?.length ?? 99) <= 5,
    `(${blogPage.json?.data?.length})`,
  );
  check('blog: buzuq sahifa rad etiladi', (await call('GET', '/blog?page=0')).status === 400);

  // --- Murojaat izohi -------------------------------------------------------
  const noteLead = await call('POST', '/leads', {
    body: { name: 'Tekshiruv', phone: '+998901112233', message: 'Asl xabar' },
  });
  const leadId = noteLead.json?.data?.id;

  const noted = await call('PUT', `/leads/${leadId}`, {
    body: { adminNote: 'Ichki qayd' },
    token: admin,
  });
  check('murojaatga izoh yoziladi', noted.status === 200 && noted.json?.data?.adminNote === 'Ichki qayd', `(${noted.status})`);
  // Izoh mijoz xabarini almashtirmasligi kerak.
  check('mijoz xabari saqlanadi', noted.json?.data?.message === 'Asl xabar');

  const statusOnly = await call('PUT', `/leads/${leadId}`, {
    body: { status: 'CONTACTED' },
    token: admin,
  });
  // Faqat holat yuborilganda izoh o'chib ketmasligi kerak.
  check(
    "holat izohni o'chirmaydi",
    statusOnly.json?.data?.status === 'CONTACTED' && statusOnly.json?.data?.adminNote === 'Ichki qayd',
    JSON.stringify({ s: statusOnly.json?.data?.status, n: statusOnly.json?.data?.adminNote }),
  );

  check("bo'sh yangilash rad etiladi", (await call('PUT', `/leads/${leadId}`, { body: {}, token: admin })).status === 400);
  await call('DELETE', `/leads/${leadId}`, { token: admin });

  // --------------------------------------------------- PREVIEW MUVOFIQLIGI
  section('14. PREVIEW MUVOFIQLIGI');

  /*
   * Konstruktordagi jonli reja brauzerda hisoblanadi. Bu bo'lim aynan
   * shu hisob serverdagi bilan bir xil natija berishini tekshiradi.
   *
   * Quvur `shared/generate.ts` da va ikki tomon ham AYNAN shu faylni
   * chaqiradi — ya'ni farq faqat kirish ma'lumotidan chiqishi mumkin.
   * Shu sababli bu yerda brauzer oladigan uchlar (`/skeletons/published`,
   * `/styles`, `/room-types`, `/estimate/price-items`) bilan
   * `/generate` natijasi solishtiriladi.
   */
  const skeletonRows = await call('GET', '/skeletons/published');
  check('andozalar ochiq', skeletonRows.status === 200, `(${skeletonRows.status})`);
  check('andozalar daraxti bilan', skeletonRows.json?.data?.every((row) => row.tree));
  check(
    'tanlash uchun kerakli maydonlar bor',
    skeletonRows.json?.data?.every(
      (row) =>
        Array.isArray(row.tagBedrooms) &&
        typeof row.minWidth === 'number' &&
        typeof row.maxLength === 'number',
    ),
  );

  // Brauzer bir xil ma'lumotdan bir xil variantni qura olishi kerak.
  const previewParams = { ...PARAMS, styleSlug: 'modern', variants: 1 };
  const serverRun = await call('POST', '/generate', { body: previewParams, token: admin });
  const serverVariant = serverRun.json?.data?.[0];

  check('server variant qaytardi', Boolean(serverVariant), `(${serverRun.status})`);

  const browserRun = await runInBrowser(previewParams);

  if (browserRun.error) {
    check('brauzer hisobi ishladi', false, browserRun.error);
  } else {
    check('brauzer hisobi ishladi', Boolean(browserRun.variant));
    check(
      'variant identifikatori bir xil',
      browserRun.variant?.id === serverVariant?.id,
      `(${browserRun.variant?.id} / ${serverVariant?.id})`,
    );
    check(
      'sifat bali bir xil',
      browserRun.variant?.score === serverVariant?.score,
      `(${browserRun.variant?.score} / ${serverVariant?.score})`,
    );
    check(
      'xonalar soni bir xil',
      browserRun.variant?.rooms === serverVariant?.floors?.[0]?.rooms?.length,
      `(${browserRun.variant?.rooms} / ${serverVariant?.floors?.[0]?.rooms?.length})`,
    );
    check(
      'maydon bir xil',
      Math.abs(browserRun.variant?.area - serverVariant?.measurements?.FLOOR_AREA) < 0.01,
      `(${browserRun.variant?.area} / ${serverVariant?.measurements?.FLOOR_AREA})`,
    );
    check(
      'smeta summasi bir xil',
      Math.abs(browserRun.variant?.total - serverVariant?.estimateTotal) < 1,
      `(${browserRun.variant?.total} / ${serverVariant?.estimateTotal})`,
    );
    check(
      'chizma bir xil',
      browserRun.variant?.coverSvg === serverVariant?.coverSvg,
      browserRun.variant?.coverSvg === serverVariant?.coverSvg
        ? ''
        : `(${browserRun.variant?.coverSvg?.length} / ${serverVariant?.coverSvg?.length} belgi)`,
    );
  }

  // ------------------------------------------------------------ XAVFSIZLIK
  section('15. XAVFSIZLIK');

  // --- Parol siyosati ------------------------------------------------------
  //
  // Zod faqat uzunlikni tekshiradi (12–128); zaiflik va sizib chiqqanlik
  // `PasswordSecurityService` (zxcvbn-ts + HIBP) zimmasida — shu sabab
  // pastdagi ikkita parol ATAYLAB 12 belgidan uzun tanlangan, aks holda
  // ular Zod bosqichida qaytarilib, keyingi bosqich sinalmay qolardi.
  const short = await call('POST', '/auth/signup', {
    body: { fullName: 'Qisqa', email: `sh${Date.now()}@archai.uz`, password: 'qisqa12345' },
  });
  check('12 belgidan qisqa parol rad etiladi', short.status === 400, `(${short.status})`);

  const weak = await call('POST', '/auth/signup', {
    body: { fullName: 'Zaif', email: `w${Date.now()}@archai.uz`, password: 'aaaaaaaaaaaa' },
  });
  check('kuchsiz lekin uzun parol rad etiladi', weak.status === 400, `(${weak.status})`);

  /*
    HIBP — "correcthorsebatterystaple" zxcvbn bo'yicha KUCHLI (4 ball),
    lekin sizib chiqqan parollar bazasida bor. Aynan shu tanlov ikki
    tekshiruvni bir-biridan ajratadi: agar HIBP so'rovi sindirilsa
    (pastdagi "Salbiy sinov"ga qarang), bu parol zxcvbn balli
    o'tib ketgani uchun QABUL qilinib qoladi — demak sinov haqiqatan
    ham HIBP yo'lini tekshiradi, zxcvbn'ni emas.
  */
  const breachedEmail = `br${Date.now()}@archai.uz`;
  const breached = await call('POST', '/auth/signup', {
    body: { fullName: 'Sizib chiqqan', email: breachedEmail, password: 'correcthorsebatterystaple' },
  });
  check('HIBP da topilgan parol rad etiladi', breached.status === 400, `(${breached.status})`);

  const derivedEmail = `deriv${Date.now()}@archai.uz`;
  const derived = await call('POST', '/auth/signup', {
    body: { fullName: 'Foydalanuvchi', email: derivedEmail, password: `${derivedEmail.split('@')[0]}X1` },
  });
  check('emaildan tuzilgan parol rad etiladi', derived.status === 400, `(${derived.status})`);

  const strongEmail = `s${Date.now()}@archai.uz`;
  createdAccounts.push(strongEmail);

  const strong = await call('POST', '/auth/signup', {
    body: { fullName: 'Kuchli', email: strongEmail, password: 'tepakalla-sichqon-42' },
  });
  check('kuchli parol qabul qilinadi', strong.status === 200, `(${strong.status})`);

  /*
    Argon2id migratsiyasi bevosita bu yerda sinalmaydi: bu skript faqat
    HTTP orqali ishlaydi, xesh prefiksini bazadan ko'rmasdan turib
    bilib bo'lmaydi. Lekin skriptning o'zi ishga tushishi allaqachon
    buni isbotlaydi — `admin` tokeni skript boshida aynan shu hisob
    bilan kirib olingan, demak `comparePassword`ning bcrypt zaxira
    yo'li (agar hali ko'chmagan bo'lsa) yoki Argon2 yo'li (ko'chgan
    bo'lsa) ishlagan.
  */

  // --- Kirish urinishlari chegarasi ---------------------------------------
  //
  // Ikki qatlam: IP bo'yicha (`RATE_LIMITS.auth`) va hisob bo'yicha
  // (`utils/login-guard.ts`). Ikkalasi ham 429 beradi.
  const victim = `brute${Date.now()}@archai.uz`;
  createdAccounts.push(victim);
  await call('POST', '/auth/signup', {
    body: { fullName: 'Nishon', email: victim, password: 'tepakalla-sichqon-42' },
  });

  let blockedAt = 0;
  for (let attempt = 1; attempt <= 20; attempt++) {
    const tried = await call('POST', '/auth/signin', {
      body: { email: victim, password: `notogri-${attempt}` },
    });

    if (tried.status === 429) {
      blockedAt = attempt;
      break;
    }
  }

  check('parol tanlash to\'xtatiladi', blockedAt > 0, `(${blockedAt || '20+'} urinishdan keyin)`);
  check('chegara oqilona', blockedAt >= 5, `(${blockedAt})`);

  // --- Yuklash hajmi ------------------------------------------------------
  const noSize = await call(
    'GET',
    '/s3/generate-policy?folder=blog&contentType=image/png&filename=a.png',
    { token: admin },
  );
  check('hajmsiz yuklash rad etiladi', noSize.status === 400, `(${noSize.status})`);

  const oversized = await call(
    'GET',
    '/s3/generate-policy?folder=blog&contentType=image/png&filename=a.png&size=999999999',
    { token: admin },
  );
  check('katta hajm rad etiladi', oversized.status === 400, `(${oversized.status})`);

  // --- Ishlab chiquvchi sahifasi -----------------------------------------
  //
  // `/dev/plan` mijoz tomonda, ya'ni bu yerdan tekshirib bo'lmaydi.
  // Brauzer sinovi (`scratchpad/security.js`) uni qamrab oladi.

  // Remove the accounts and projects this run created. Failures here are
  // ignored on purpose: cleanup must never change the run's verdict.
  const people = await call('GET', '/users/paginated?limit=100', { token: admin });
  const stale = (people.json?.data?.items ?? []).filter((row) =>
    createdAccounts.includes(row.email),
  );

  for (const row of stale) {
    await call('DELETE', `/users/${row.id}`, { token: admin }).catch(() => {});
  }

  const mine = await call('GET', '/projects?limit=50', { token: admin });
  for (const project of mine.json?.data ?? []) {
    if (['Tekshiruv loyihasi', 'Yangi nom', 'Test uy — PDF sinovi'].includes(project.title)) {
      await call('DELETE', `/projects/${project.id}`, { token: admin }).catch(() => {});
    }
  }

  console.log(`\ntozalandi: ${stale.length} hisob`);

  // ------------------------------------------------ TO'LOV KARTALARI (admin)
  section("16. TO'LOV KARTALARI (admin)");

  check('ro\'yxat mehmonga yopiq', (await call('GET', '/payout-cards')).status === 401);

  /*
    `userToken` bu yergacha eskirgan bo'lishi mumkin (1-bo'limda parol
    tiklash uni bekor qiladi) — shu sabab bu yerga alohida, yangi
    oddiy foydalanuvchi olinadi.
  */
  const payoutViewerEmail = `payout-viewer-${Date.now()}@archai.uz`;
  const payoutViewer = await call('POST', '/auth/signup', {
    body: { fullName: 'Payout Viewer', email: payoutViewerEmail, password: 'tepakalla-sichqon-42' },
  });
  const payoutViewerToken = payoutViewer.json?.data?.accessToken;

  check(
    'ro\'yxat oddiy foydalanuvchiga yopiq',
    (await call('GET', '/payout-cards', { token: payoutViewerToken })).status === 403,
  );

  const billingSecret = process.env.BILLING_SECRET;

  if (!billingSecret) {
    console.log("    diqqat: BILLING_SECRET sozlanmagan — to'lov kartalari sinalmadi");
  } else {
    const payoutCall = (method, path, { body, secret } = {}) =>
      callWithHeaders(method, path, {
        body,
        headers: {
          Authorization: `Bearer ${admin}`,
          ...(secret !== undefined ? { 'X-Billing-Secret': secret } : {}),
        },
      });

    /*
      Oldingi (masalan, yarim yiqilgan) yugurishdan qolgan nofaol sinov
      kartalarini tozalaymiz. Faol qolgan bo'lsa tegmaymiz — uni pastda
      yangi faol karta o'zi almashtiradi va shundan keyin nofaolga
      aylanib, KEYINGI yugurishda shu yerda tozalanadi.
    */
    const before = await call('GET', '/payout-cards', { token: admin });
    for (const row of before.json?.data ?? []) {
      if (row.label.startsWith('Verify Test') && !row.active) {
        await payoutCall('DELETE', `/payout-cards/${row.id}`, { secret: billingSecret });
      }
    }

    const cardBody = (label) => ({
      provider: 'CLICK',
      label,
      last4: '4242',
      holder: 'Verify Holder',
      expiry: '12/30',
      accountId: 'verify-merchant-account',
    });

    const createNoSecret = await payoutCall('POST', '/payout-cards', { body: cardBody('Verify Test A') });
    check(
      "karta: kalitsiz qo'shish rad etiladi",
      createNoSecret.status === 403 && createNoSecret.json?._code === 'BILLING_SECRET_INVALID',
      `(${createNoSecret.status} ${createNoSecret.json?._code})`,
    );

    const createBadSecret = await payoutCall('POST', '/payout-cards', {
      body: cardBody('Verify Test A'),
      secret: 'notogri-kalit',
    });
    check(
      "karta: noto'g'ri kalit bilan qo'shish rad etiladi",
      createBadSecret.status === 403,
      `(${createBadSecret.status})`,
    );

    const cardA = await payoutCall('POST', '/payout-cards', {
      body: cardBody('Verify Test A'),
      secret: billingSecret,
    });
    check('karta A qo\'shildi', cardA.status === 200 && cardA.json?.data?.active === false, `(${cardA.status})`);

    const cardB = await payoutCall('POST', '/payout-cards', {
      body: cardBody('Verify Test B'),
      secret: billingSecret,
    });
    check('karta B qo\'shildi', cardB.status === 200, `(${cardB.status})`);

    const activateNoSecret = await payoutCall('POST', `/payout-cards/${cardB.json?.data?.id}/activate`);
    check(
      'karta: kalitsiz faollashtirish rad etiladi',
      activateNoSecret.status === 403,
      `(${activateNoSecret.status})`,
    );

    const activateB = await payoutCall('POST', `/payout-cards/${cardB.json?.data?.id}/activate`, {
      secret: billingSecret,
    });
    check(
      'karta B faollashdi',
      activateB.status === 200 && activateB.json?.data?.active === true,
      `(${activateB.status})`,
    );

    const afterActivate = await call('GET', '/payout-cards', { token: admin });
    const rowA = afterActivate.json?.data?.find((row) => row.id === cardA.json?.data?.id);
    const rowB = afterActivate.json?.data?.find((row) => row.id === cardB.json?.data?.id);
    check(
      'bitta provayderda faqat bitta faol karta',
      rowA?.active === false && rowB?.active === true,
      `(A=${rowA?.active}, B=${rowB?.active})`,
    );

    const removeActive = await payoutCall('DELETE', `/payout-cards/${cardB.json?.data?.id}`, {
      secret: billingSecret,
    });
    check(
      "karta: faol karta o'chirilmaydi",
      removeActive.status === 409 && removeActive.json?._code === 'PAYOUT_CARD_ACTIVE_CANNOT_REMOVE',
      `(${removeActive.status} ${removeActive.json?._code})`,
    );

    const removeInactive = await payoutCall('DELETE', `/payout-cards/${cardA.json?.data?.id}`, {
      secret: billingSecret,
    });
    check("karta: nofaol karta o'chiriladi", removeInactive.status === 200, `(${removeInactive.status})`);

    const cardAudit = await call('GET', '/audit?entity=payout_card&limit=5', { token: admin });
    const auditEntry = cardAudit.json?.data?.find((row) => row.entityId === cardB.json?.data?.id);
    check(
      'jurnalga faqat last4 yoziladi',
      Boolean(auditEntry) && Object.keys(auditEntry.diff ?? {}).every((key) => key === 'last4'),
      JSON.stringify(auditEntry?.diff),
    );
  }

  if (payoutViewerToken) {
    const viewerSelf = await call('GET', '/auth/me', { token: payoutViewerToken });
    if (viewerSelf.json?.data?.id) {
      await call('DELETE', `/users/${viewerSelf.json.data.id}`, { token: admin }).catch(() => {});
    }
  }

  // ----------------------------------------------------------------- NATIJA
  console.log(`\n${'='.repeat(52)}`);
  console.log(`NATIJA: ${pass} o'tdi, ${fail} yiqildi`);

  if (failures.length > 0) {
    console.log(`\nYiqilganlar:\n  - ${failures.join('\n  - ')}`);
  }

  process.exit(fail > 0 ? 1 : 0);
}

/**
 * Bir xil parametrlarni BRAUZERDA hisoblash.
 *
 * Nima uchun haqiqiy brauzer: `ui/lib/shared/` faqat u yerda ishlaydi
 * (`@/` yo'llari Next tomonidan hal qilinadi) va biz aynan
 * foydalanuvchi ko'radigan kodni sinamoqchimiz, uning Node'dagi
 * ko'zgusini emas.
 *
 * UI ishlamayotgan bo'lsa bo'lim o'tkazib yuborilmaydi — xato sifatida
 * qaytadi, chunki "tekshirmadik" bilan "hammasi joyida" ni aralashtirib
 * bo'lmaydi.
 */
async function runInBrowser(params) {
  let puppeteer;
  try {
    puppeteer = require('puppeteer');
  } catch {
    return { error: 'puppeteer yo\'q' };
  }

  const base = process.env.UI_URL || 'http://localhost:3000';

  let browser;
  try {
    browser = await puppeteer.launch({ headless: 'new' });
    const page = await browser.newPage();

    await page.goto(`${base}/uz/konstruktor`, { waitUntil: 'domcontentloaded', timeout: 120000 });

    // Sahifa `lib/generate.ts` ni o'zi yuklaydi; biz uni jonli reja
    // chizilganini kutib, keyin `window` orqali chaqiramiz.
    await page.waitForFunction(() => Boolean(window.__archaiPreview), { timeout: 90000 });

    const variant = await page.evaluate(
      (input) => window.__archaiPreview(input),
      params,
    );

    return { variant };
  } catch (error) {
    return { error: error.message.slice(0, 160) };
  } finally {
    await browser?.close();
  }
}

main().catch((error) => {
  console.error('SKRIPT YIQILDI:', error.message);
  process.exit(1);
});
