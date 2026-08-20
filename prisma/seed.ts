import {
  PrismaClient,
  PRICE_CATEGORY,
  ROOF_FAMILY,
  USER_ROLE,
  CONTENT_STATUS,
} from '../generated/prisma';
import { hashPassword } from '../modules/auth';

const prisma = new PrismaClient();

const t = (uz: string, ru: string, en: string) => ({ uz, ru, en });


const ROOM_TYPES = [
  {
    code: 'living',
    selectable: true,
    maxCount: 3,
    defaultCount: 1,
    name: t('Mehmonxona', 'Гостиная', 'Living room'),
    minArea: 16,
    maxArea: 45,
    idealRatio: 1.5,
    needsExteriorWall: true,
    isWetZone: false,
    accessFrom: [] as string[],
    furnitureTags: ['sofa', 'coffee_table', 'tv_stand'],
    sort: 1,
  },
  {
    code: 'bedroom',
    selectable: true,
    maxCount: 8,
    defaultCount: 2,
    name: t('Yotoqxona', 'Спальня', 'Bedroom'),
    minArea: 9,
    maxArea: 25,
    idealRatio: 1.3,
    needsExteriorWall: true,
    isWetZone: false,
    accessFrom: ['corridor', 'hall', 'living'],
    furnitureTags: ['bed', 'wardrobe', 'nightstand'],
    sort: 2,
  },
  {
    code: 'kitchen',
    name: t('Oshxona', 'Кухня', 'Kitchen'),
    minArea: 8,
    maxArea: 20,
    idealRatio: 1.4,
    needsExteriorWall: true,
    isWetZone: true,
    accessFrom: [],
    furnitureTags: ['kitchen_set', 'dining_table'],
    sort: 3,
  },
  {
    code: 'bathroom',
    selectable: true,
    maxCount: 5,
    defaultCount: 1,
    name: t('Sanuzel', 'Санузел', 'Bathroom'),
    minArea: 3,
    maxArea: 8,
    idealRatio: 1.5,
    needsExteriorWall: false,
    isWetZone: true,
    // Yotoqxona orqali kirilmasin — bu eng ko'p uchraydigan reja xatosi.
    accessFrom: ['corridor', 'hall', 'living'],
    furnitureTags: ['toilet', 'shower', 'sink'],
    sort: 4,
  },
  {
    code: 'corridor',
    name: t('Koridor', 'Коридор', 'Corridor'),
    minArea: 3,
    maxArea: 20,
    // Koridor tabiatan cho'ziq: haqiqiy koridor 1.4 × 8 m bo'lishi normal.
    // Tekshiruvda ruxsat etilgan chegara shundan hisoblanadi (ideal × 2).
    idealRatio: 5,
    needsExteriorWall: false,
    isWetZone: false,
    accessFrom: [],
    furnitureTags: [],
    sort: 5,
  },
  {
    code: 'hall',
    name: t('Kirish xonasi', 'Прихожая', 'Hall'),
    minArea: 4,
    maxArea: 15,
    idealRatio: 2,
    needsExteriorWall: false,
    isWetZone: false,
    accessFrom: [],
    furnitureTags: ['shoe_rack', 'coat_rack'],
    sort: 6,
  },
  {
    code: 'dining',
    selectable: true,
    maxCount: 2,
    defaultCount: 0,
    name: t('Ovqatlanish xonasi', 'Столовая', 'Dining room'),
    minArea: 10,
    maxArea: 30,
    idealRatio: 1.4,
    needsExteriorWall: true,
    isWetZone: false,
    accessFrom: [],
    furnitureTags: ['dining_table', 'chairs'],
    sort: 7,
  },
  {
    code: 'office',
    selectable: true,
    maxCount: 3,
    defaultCount: 0,
    name: t('Ish xonasi', 'Кабинет', 'Office'),
    minArea: 7,
    maxArea: 20,
    idealRatio: 1.3,
    needsExteriorWall: true,
    isWetZone: false,
    accessFrom: ['corridor', 'hall', 'living'],
    furnitureTags: ['desk', 'bookshelf'],
    sort: 8,
  },
  {
    code: 'laundry',
    name: t('Kir yuvish xonasi', 'Прачечная', 'Laundry'),
    minArea: 3,
    maxArea: 10,
    idealRatio: 1.6,
    needsExteriorWall: false,
    isWetZone: true,
    accessFrom: ['corridor', 'hall', 'kitchen'],
    furnitureTags: ['washer'],
    sort: 9,
  },
  {
    code: 'storage',
    name: t('Omborxona', 'Кладовая', 'Storage'),
    minArea: 2,
    maxArea: 12,
    idealRatio: 2,
    needsExteriorWall: false,
    isWetZone: false,
    accessFrom: [],
    furnitureTags: ['shelving'],
    sort: 10,
  },
];

const ROOF_STYLES = [
  {
    code: 'flat-membrane',
    name: t('Tekis tom', 'Плоская кровля', 'Flat roof'),
    family: ROOF_FAMILY.flat,
    pitch: 3,
    overhang: 0.6,
    color: '#3A3A3C',
    covering: 'yumshoq',
    sort: 1,
  },
  {
    code: 'gable-25',
    name: t('Ikki nishabli 25°', 'Двускатная 25°', 'Gable 25°'),
    family: ROOF_FAMILY.gable,
    pitch: 25,
    overhang: 0.5,
    color: '#6B4A32',
    covering: 'metallocherepitsa',
    sort: 2,
  },
  {
    code: 'gable-40',
    name: t('Ikki nishabli 40°', 'Двускатная 40°', 'Gable 40°'),
    family: ROOF_FAMILY.gable,
    pitch: 40,
    overhang: 0.7,
    color: '#8B3A2E',
    covering: 'cherepitsa',
    sort: 3,
  },
  {
    code: 'hip-30',
    name: t('Valma tom', 'Вальмовая кровля', 'Hip roof'),
    family: ROOF_FAMILY.hip,
    pitch: 30,
    overhang: 0.6,
    color: '#4A4A4C',
    covering: 'metallocherepitsa',
    sort: 4,
  },
  {
    code: 'shed-15',
    name: t('Yakka nishabli', 'Односкатная', 'Shed roof'),
    family: ROOF_FAMILY.shed,
    pitch: 15,
    overhang: 0.4,
    color: '#3A3A3C',
    covering: 'profnastil',
    sort: 5,
  },
  {
    code: 'pyramid-35',
    name: t('Piramida', 'Пирамидальная', 'Pyramid roof'),
    family: ROOF_FAMILY.pyramid,
    pitch: 35,
    overhang: 0.6,
    color: '#5A3E2B',
    covering: 'cherepitsa',
    sort: 6,
  },
  {
    code: 'mansard-classic',
    name: t('Mansard', 'Мансардная', 'Mansard roof'),
    family: ROOF_FAMILY.mansard,
    pitch: 65,
    // Pastki qism tik, yuqorisi yotiq — tom ostida yashash mumkin.
    upperPitch: 25,
    breakRatio: 0.55,
    overhang: 0.5,
    color: '#4A3B2F',
    covering: 'yumshoq',
    sort: 7,
  },
  {
    code: 'mansard-steep',
    name: t('Baland mansard', 'Высокая мансарда', 'Steep mansard'),
    family: ROOF_FAMILY.mansard,
    pitch: 70,
    upperPitch: 20,
    breakRatio: 0.7,
    overhang: 0.6,
    color: '#2F3A34',
    covering: 'cherepitsa',
    sort: 8,
  },
];

/** Qaysi uslub qaysi tom presetidan boshlaydi. */
const STYLE_ROOFS: Record<string, string> = {
  modern: 'flat-membrane',
  classic: 'gable-40',
  minimalist: 'shed-15',
  loft: 'hip-30',
};

/** Uslub — rasm emas, qoidalar to'plami. */
const STYLES = [
  {
    slug: 'modern',
    name: t('Modern', 'Модерн', 'Modern'),
    description: t(
      'Toza chiziqlar, keng derazalar, tekis yoki past nishabli tom.',
      'Чистые линии, панорамные окна, плоская кровля.',
      'Clean lines, wide windows, flat or low-pitch roof.',
    ),
    roof: { type: 'flat', pitch: 3, overhang: 0.6, material: 'membrane', color: '#3A3A3C' },
    facade: { material: 'plaster', primary: '#EDEAE5', accent: '#3A3A3C', plinth: '#2B2B2D' },
    window: { ratio: 1.6, wallAreaRatio: 0.22, frameColor: '#2B2B2D', panoramic: true },
    interior: {
      ceilingHeight: 3.0,
      wallColor: '#F5F3F0',
      floorByRoomType: { living: 'laminate', bedroom: 'laminate', kitchen: 'tile', bathroom: 'tile' },
      skirting: '#FFFFFF',
    },
    layoutRules: { corridorWidth: 1.5, openKitchen: true, minAreaFactor: 1 },
  },
  {
    slug: 'classic',
    name: t('Classic', 'Классика', 'Classic'),
    description: t(
      'Simmetrik fasad, ikki nishabli tom, an\'anaviy deraza proporsiyalari.',
      'Симметричный фасад, двускатная кровля, традиционные окна.',
      'Symmetric facade, gable roof, traditional window proportions.',
    ),
    roof: { type: 'gable', pitch: 32, overhang: 0.7, material: 'tile', color: '#7A3B2E' },
    facade: { material: 'brick', primary: '#C9A882', accent: '#F5F0E6', plinth: '#6B5B4A' },
    window: { ratio: 0.7, wallAreaRatio: 0.14, frameColor: '#FFFFFF', panoramic: false },
    interior: {
      ceilingHeight: 2.9,
      wallColor: '#F7F2E8',
      floorByRoomType: { living: 'parquet', bedroom: 'parquet', kitchen: 'tile', bathroom: 'tile' },
      skirting: '#FFFFFF',
    },
    layoutRules: { corridorWidth: 1.4, openKitchen: false, minAreaFactor: 1.05 },
  },
  {
    slug: 'minimalist',
    name: t('Minimalist', 'Минимализм', 'Minimalist'),
    description: t(
      'Sodda shakl, kam bezak, tabiiy ranglar.',
      'Простые формы, минимум декора, природные цвета.',
      'Simple forms, little ornament, natural colours.',
    ),
    roof: { type: 'shed', pitch: 8, overhang: 0.4, material: 'metal', color: '#4A4A4C' },
    facade: { material: 'plaster', primary: '#FAFAF8', accent: '#9A9A97', plinth: '#6E6E6B' },
    window: { ratio: 1.4, wallAreaRatio: 0.18, frameColor: '#4A4A4C', panoramic: false },
    interior: {
      ceilingHeight: 2.9,
      wallColor: '#FFFFFF',
      floorByRoomType: { living: 'concrete', bedroom: 'laminate', kitchen: 'tile', bathroom: 'tile' },
      skirting: '#F0F0F0',
    },
    layoutRules: { corridorWidth: 1.3, openKitchen: true, minAreaFactor: 0.95 },
  },
  {
    slug: 'loft',
    name: t('Loft', 'Лофт', 'Loft'),
    description: t(
      'Ochiq g\'isht, baland shift, sanoat uslubidagi detallar.',
      'Открытый кирпич, высокие потолки, индустриальные детали.',
      'Exposed brick, high ceilings, industrial details.',
    ),
    roof: { type: 'flat', pitch: 2, overhang: 0.3, material: 'membrane', color: '#2E2E30' },
    facade: { material: 'brick', primary: '#8C5A4A', accent: '#2E2E30', plinth: '#4A3A32' },
    window: { ratio: 1.2, wallAreaRatio: 0.24, frameColor: '#1F1F21', panoramic: true },
    interior: {
      ceilingHeight: 3.4,
      wallColor: '#E8E2DC',
      floorByRoomType: { living: 'concrete', bedroom: 'concrete', kitchen: 'concrete', bathroom: 'tile' },
      skirting: '#2E2E30',
    },
    layoutRules: { corridorWidth: 1.6, openKitchen: true, minAreaFactor: 1.1 },
  },
];

/**
 * Narx bazasi. `measure` — geometriyaning qaysi o'lchovidan olinishini
 * ko'rsatadi; `geometry/measure.ts` shu kalitlarni qaytaradi.
 */
const PRICE_ITEMS = [
  { code: 'foundation_strip', category: PRICE_CATEGORY.FOUNDATION, name: t('Lentali poydevor', 'Ленточный фундамент', 'Strip foundation'), unit: 'm³', unitPrice: 1_450_000, measure: 'FOUNDATION_VOLUME', sort: 1 },
  { code: 'wall_exterior', category: PRICE_CATEGORY.WALLS, name: t('Tashqi devor (g\'isht)', 'Наружная стена', 'Exterior wall'), unit: 'm²', unitPrice: 620_000, measure: 'EXTERIOR_WALL_AREA', sort: 2 },
  { code: 'wall_interior', category: PRICE_CATEGORY.WALLS, name: t('Ichki devor', 'Внутренняя стена', 'Interior wall'), unit: 'm²', unitPrice: 310_000, measure: 'INTERIOR_WALL_AREA', sort: 3 },
  { code: 'roof_cover', category: PRICE_CATEGORY.ROOF, name: t('Tom qoplamasi', 'Кровельное покрытие', 'Roof covering'), unit: 'm²', unitPrice: 480_000, measure: 'ROOF_AREA', sort: 4 },
  { code: 'window_unit', category: PRICE_CATEGORY.WINDOWS_DOORS, name: t('Deraza', 'Окно', 'Window'), unit: 'dona', unitPrice: 2_100_000, measure: 'WINDOW_COUNT', sort: 5 },
  { code: 'door_unit', category: PRICE_CATEGORY.WINDOWS_DOORS, name: t('Eshik', 'Дверь', 'Door'), unit: 'dona', unitPrice: 1_350_000, measure: 'DOOR_COUNT', sort: 6 },
  { code: 'floor_finish', category: PRICE_CATEGORY.FINISHING, name: t('Pol pardozi', 'Отделка пола', 'Floor finishing'), unit: 'm²', unitPrice: 340_000, measure: 'FLOOR_AREA', sort: 7 },
  { code: 'ceiling_finish', category: PRICE_CATEGORY.FINISHING, name: t('Shift pardozi', 'Отделка потолка', 'Ceiling finishing'), unit: 'm²', unitPrice: 190_000, measure: 'CEILING_AREA', sort: 8 },
  { code: 'wall_finish', category: PRICE_CATEGORY.FINISHING, name: t('Devor pardozi', 'Отделка стен', 'Wall finishing'), unit: 'm²', unitPrice: 165_000, measure: 'WALL_AREA', sort: 9 },
  { code: 'electrical', category: PRICE_CATEGORY.UTILITIES, name: t('Elektr montaji', 'Электромонтаж', 'Electrical'), unit: 'm²', unitPrice: 210_000, measure: 'FLOOR_AREA', sort: 10 },
  { code: 'plumbing', category: PRICE_CATEGORY.UTILITIES, name: t('Suv va kanalizatsiya', 'Водоснабжение', 'Plumbing'), unit: 'm²', unitPrice: 145_000, measure: 'FLOOR_AREA', sort: 11 },
  { code: 'heating', category: PRICE_CATEGORY.UTILITIES, name: t('Isitish tizimi', 'Отопление', 'Heating'), unit: 'm²', unitPrice: 260_000, measure: 'FLOOR_AREA', sort: 12 },

  // Qo'shimcha hajmlar — kompleks narx: poydevor, devor, tom va pardoz
  // birgalikda. Garajning kvadrat metri yashash xonasinikidan arzon.
  { code: 'garage_build', category: PRICE_CATEGORY.OTHER, name: t('Garaj (kompleks)', 'Гараж (комплекс)', 'Garage (complete)'), unit: 'm²', unitPrice: 1_650_000, measure: 'GARAGE_AREA', sort: 20 },
  { code: 'terrace_build', category: PRICE_CATEGORY.OTHER, name: t('Terrassa', 'Терраса', 'Terrace'), unit: 'm²', unitPrice: 890_000, measure: 'TERRACE_AREA', sort: 21 },
  { code: 'balcony_build', category: PRICE_CATEGORY.OTHER, name: t('Balkon', 'Балкон', 'Balcony'), unit: 'm²', unitPrice: 1_150_000, measure: 'BALCONY_AREA', sort: 22 },
  { code: 'basement_build', category: PRICE_CATEGORY.OTHER, name: t('Yerto\'la (qazish bilan)', 'Подвал (с выемкой)', 'Basement (with excavation)'), unit: 'm²', unitPrice: 2_400_000, measure: 'BASEMENT_AREA', sort: 23 },
  { code: 'sauna_build', category: PRICE_CATEGORY.OTHER, name: t('Sauna', 'Сауна', 'Sauna'), unit: 'm²', unitPrice: 3_100_000, measure: 'SAUNA_AREA', sort: 24 },
  { code: 'pool_build', category: PRICE_CATEGORY.OTHER, name: t('Hovuz', 'Бассейн', 'Pool'), unit: 'm²', unitPrice: 4_200_000, measure: 'POOL_AREA', sort: 25 },
];

/**
 * Material variantlari — narxni aynan shular belgilaydi.
 *
 * `PriceItem.unitPrice` faqat zaxira: hech qanday material tanlanmagan
 * va pardoz to'plamida ham yo'q bo'lsa ishlatiladi.
 *
 * Narxlar 2026-yil boshidagi Toshkent bozoriga taxminan mos; admin
 * ularni panel orqali o'zgartiradi va `db:seed` endi ustidan yozmaydi.
 */
const PRICE_OPTIONS: Array<{
  item: string;
  code: string;
  name: ReturnType<typeof t>;
  unitPrice: number;
  sort: number;
}> = [
  // Poydevor
  { item: 'foundation_strip', code: 'ustunli', name: t('Ustunli poydevor', 'Столбчатый', 'Pier'), unitPrice: 980_000, sort: 1 },
  { item: 'foundation_strip', code: 'lentali', name: t('Lentali poydevor', 'Ленточный', 'Strip'), unitPrice: 1_450_000, sort: 2 },
  { item: 'foundation_strip', code: 'plita', name: t('Plita poydevor', 'Плитный', 'Raft slab'), unitPrice: 1_950_000, sort: 3 },

  // Tashqi devor
  { item: 'wall_exterior', code: 'sendvich', name: t('Sendvich panel', 'Сэндвич-панель', 'Sandwich panel'), unitPrice: 390_000, sort: 1 },
  { item: 'wall_exterior', code: 'gazoblok', name: t('Gazoblok', 'Газоблок', 'Aerated block'), unitPrice: 480_000, sort: 2 },
  { item: 'wall_exterior', code: 'keramzit', name: t('Keramzit blok', 'Керамзитоблок', 'Expanded clay block'), unitPrice: 540_000, sort: 3 },
  { item: 'wall_exterior', code: 'gisht', name: t('G\'isht', 'Кирпич', 'Brick'), unitPrice: 620_000, sort: 4 },

  // Ichki devor
  { item: 'wall_interior', code: 'gipsokarton', name: t('Gipsokarton', 'Гипсокартон', 'Drywall'), unitPrice: 210_000, sort: 1 },
  { item: 'wall_interior', code: 'gazoblok', name: t('Gazoblok', 'Газоблок', 'Aerated block'), unitPrice: 260_000, sort: 2 },
  { item: 'wall_interior', code: 'gisht', name: t('G\'isht', 'Кирпич', 'Brick'), unitPrice: 310_000, sort: 3 },

  // Tom
  { item: 'roof_cover', code: 'profnastil', name: t('Profnastil', 'Профнастил', 'Corrugated sheet'), unitPrice: 380_000, sort: 1 },
  { item: 'roof_cover', code: 'metallocherepitsa', name: t('Metallocherepitsa', 'Металлочерепица', 'Metal tile'), unitPrice: 480_000, sort: 2 },
  { item: 'roof_cover', code: 'yumshoq', name: t('Yumshoq tom', 'Мягкая кровля', 'Bitumen shingle'), unitPrice: 560_000, sort: 3 },
  { item: 'roof_cover', code: 'cherepitsa', name: t('Tabiiy cherepitsa', 'Натуральная черепица', 'Clay tile'), unitPrice: 890_000, sort: 4 },

  // Deraza
  { item: 'window_unit', code: 'pvx_oddiy', name: t('PVX, bir kamerali', 'ПВХ однокамерный', 'PVC single chamber'), unitPrice: 1_500_000, sort: 1 },
  { item: 'window_unit', code: 'pvx_ikki', name: t('PVX, ikki kamerali', 'ПВХ двухкамерный', 'PVC double chamber'), unitPrice: 2_100_000, sort: 2 },
  { item: 'window_unit', code: 'alyumin', name: t('Alyuminiy profil', 'Алюминиевый профиль', 'Aluminium'), unitPrice: 3_200_000, sort: 3 },

  // Eshik
  { item: 'door_unit', code: 'mdf', name: t('MDF eshik', 'МДФ дверь', 'MDF door'), unitPrice: 900_000, sort: 1 },
  { item: 'door_unit', code: 'yogoch', name: t('Tabiiy yog\'och', 'Натуральное дерево', 'Solid wood'), unitPrice: 1_350_000, sort: 2 },
  { item: 'door_unit', code: 'polat', name: t('Po\'lat eshik', 'Стальная дверь', 'Steel door'), unitPrice: 2_100_000, sort: 3 },

  // Pol pardozi
  { item: 'floor_finish', code: 'linoleum', name: t('Linoleum', 'Линолеум', 'Linoleum'), unitPrice: 180_000, sort: 1 },
  { item: 'floor_finish', code: 'laminat', name: t('Laminat', 'Ламинат', 'Laminate'), unitPrice: 340_000, sort: 2 },
  { item: 'floor_finish', code: 'keramogranit', name: t('Keramogranit', 'Керамогранит', 'Porcelain tile'), unitPrice: 520_000, sort: 3 },
  { item: 'floor_finish', code: 'parket', name: t('Tabiiy parket', 'Паркет', 'Hardwood'), unitPrice: 780_000, sort: 4 },

  // Shift pardozi
  { item: 'ceiling_finish', code: 'boyoq', name: t('Bo\'yoq', 'Покраска', 'Paint'), unitPrice: 120_000, sort: 1 },
  { item: 'ceiling_finish', code: 'tortma', name: t('Tortma shift', 'Натяжной потолок', 'Stretch ceiling'), unitPrice: 190_000, sort: 2 },
  { item: 'ceiling_finish', code: 'gipsokarton', name: t('Gipsokarton, ko\'p qavatli', 'Многоуровневый ГКЛ', 'Multi-level drywall'), unitPrice: 310_000, sort: 3 },

  // Devor pardozi
  { item: 'wall_finish', code: 'boyoq', name: t('Bo\'yoq', 'Покраска', 'Paint'), unitPrice: 110_000, sort: 1 },
  { item: 'wall_finish', code: 'oboy', name: t('Oboy', 'Обои', 'Wallpaper'), unitPrice: 165_000, sort: 2 },
  { item: 'wall_finish', code: 'dekorativ', name: t('Dekorativ shtukaturka', 'Декоративная штукатурка', 'Decorative plaster'), unitPrice: 340_000, sort: 3 },

  // Muhandislik tizimlari
  { item: 'electrical', code: 'oddiy', name: t('Oddiy montaj', 'Базовый монтаж', 'Basic'), unitPrice: 150_000, sort: 1 },
  { item: 'electrical', code: 'standart', name: t('Standart montaj', 'Стандартный монтаж', 'Standard'), unitPrice: 210_000, sort: 2 },
  { item: 'electrical', code: 'aqlli', name: t('Aqlli uy tizimi', 'Умный дом', 'Smart home'), unitPrice: 480_000, sort: 3 },

  { item: 'plumbing', code: 'oddiy', name: t('Oddiy quvurlar', 'Базовые трубы', 'Basic'), unitPrice: 105_000, sort: 1 },
  { item: 'plumbing', code: 'standart', name: t('Standart quvurlar', 'Стандартные трубы', 'Standard'), unitPrice: 145_000, sort: 2 },
  { item: 'plumbing', code: 'premium', name: t('Premium armatura', 'Премиум арматура', 'Premium'), unitPrice: 260_000, sort: 3 },

  { item: 'heating', code: 'radiator', name: t('Radiator isitish', 'Радиаторное', 'Radiators'), unitPrice: 260_000, sort: 1 },
  { item: 'heating', code: 'issiq_pol', name: t('Issiq pol', 'Тёплый пол', 'Underfloor'), unitPrice: 420_000, sort: 2 },
];

/**
 * Pardoz darajasi — sukutdagi materiallar to'plami.
 *
 * Ro'yxatda ko'rsatilmagan ish turlari `PriceItem.unitPrice` bilan
 * qoladi. Foydalanuvchi har bir bandni alohida o'zgartira oladi.
 */
const FINISH_LEVELS = [
  {
    code: 'basic',
    name: t('Oddiy', 'Базовая', 'Basic'),
    sort: 1,
    defaults: {
      foundation_strip: 'ustunli',
      wall_exterior: 'gazoblok',
      wall_interior: 'gipsokarton',
      roof_cover: 'profnastil',
      window_unit: 'pvx_oddiy',
      door_unit: 'mdf',
      floor_finish: 'linoleum',
      ceiling_finish: 'boyoq',
      wall_finish: 'boyoq',
      electrical: 'oddiy',
      plumbing: 'oddiy',
      heating: 'radiator',
    },
  },
  {
    code: 'standard',
    name: t('O\'rta', 'Стандарт', 'Standard'),
    sort: 2,
    defaults: {
      foundation_strip: 'lentali',
      wall_exterior: 'gisht',
      wall_interior: 'gazoblok',
      roof_cover: 'metallocherepitsa',
      window_unit: 'pvx_ikki',
      door_unit: 'yogoch',
      floor_finish: 'laminat',
      ceiling_finish: 'tortma',
      wall_finish: 'oboy',
      electrical: 'standart',
      plumbing: 'standart',
      heating: 'radiator',
    },
  },
  {
    code: 'premium',
    name: t('Premium', 'Премиум', 'Premium'),
    sort: 3,
    defaults: {
      foundation_strip: 'plita',
      wall_exterior: 'gisht',
      wall_interior: 'gisht',
      roof_cover: 'cherepitsa',
      window_unit: 'alyumin',
      door_unit: 'polat',
      floor_finish: 'parket',
      ceiling_finish: 'gipsokarton',
      wall_finish: 'dekorativ',
      electrical: 'aqlli',
      plumbing: 'premium',
      heating: 'issiq_pol',
    },
  },
];

const PLANS = [
  {
    code: 'free',
    name: t('Free', 'Free', 'Free'),
    priceUzs: 0,
    priceUsd: 0,
    limits: { projects: 1, variants: 1, pdf: false, dwg: false, interior: false, edit: false, versions: 0, watermark: true },
    sort: 1,
  },
  {
    code: 'basic',
    name: t('Basic', 'Basic', 'Basic'),
    priceUzs: 129_000,
    priceUsd: 9.99,
    limits: { projects: 10, variants: 4, pdf: true, dwg: false, interior: true, edit: true, versions: 5, watermark: false },
    sort: 2,
  },
  {
    code: 'pro',
    name: t('Pro', 'Pro', 'Pro'),
    priceUzs: 399_000,
    priceUsd: 29.99,
    limits: { projects: -1, variants: -1, pdf: true, dwg: 'on_request', interior: true, edit: true, versions: -1, watermark: false },
    sort: 3,
  },
];

/**
 * Boshlang'ich skeletlar.
 *
 * Bular generator uchun bazaviy rejalar: arxitektura mantig'i shu yerda bir
 * marta qo'yiladi, tizim esa uni foydalanuvchi o'lchamiga cheksiz
 * moslashtiradi. Har birida koridor yoki kirish xonasi bor — busiz
 * yotoqxonaga boshqa xona orqali kirishga to'g'ri kelardi.
 *
 * Ishga tushirishga 15–20 ta kerak; bular birinchi uchtasi va namuna.
 */
const leaf = (id: string, roomType: string) => ({ kind: 'leaf' as const, id, roomType });
const split = (id: string, axis: 'vertical' | 'horizontal', ratio: number, a: unknown, b: unknown) => ({
  kind: 'split' as const,
  id,
  axis,
  ratio,
  children: [a, b],
});

const SKELETONS = [
  {
    name: 'Ixcham — 2 yotoqxona, 1 qavat',
    floors: 1,
    tagBedrooms: [2],
    tagStyles: [],
    minWidth: 8,
    maxWidth: 13,
    minLength: 9,
    maxLength: 15,
    tree: {
      floors: [
        {
          level: 1,
          // Yuqorida yashash zonasi, o'rtada koridor, pastda yotoq zonasi.
          tree: split(
            's1',
            'horizontal',
            0.44,
            split('s2', 'vertical', 0.56, leaf('n1', 'living'), leaf('n2', 'kitchen')),
            split(
              's3',
              'horizontal',
              0.24,
              leaf('n3', 'corridor'),
              split(
                's4',
                'vertical',
                0.68,
                split('s5', 'vertical', 0.5, leaf('n4', 'bedroom'), leaf('n5', 'bedroom')),
                split('s6', 'horizontal', 0.5, leaf('n6', 'bathroom'), leaf('n7', 'storage')),
              ),
            ),
          ),
        },
      ],
    },
  },
  {
    name: 'Keng — 3 yotoqxona, 1 qavat',
    floors: 1,
    tagBedrooms: [3],
    tagStyles: [],
    minWidth: 10,
    maxWidth: 17,
    minLength: 11,
    maxLength: 18,
    tree: {
      floors: [
        {
          level: 1,
          tree: split(
            's1',
            'horizontal',
            0.4,
            split('s2', 'vertical', 0.6, leaf('n1', 'living'), leaf('n2', 'kitchen')),
            split(
              's3',
              'horizontal',
              0.2,
              leaf('n3', 'corridor'),
              split(
                's4',
                'vertical',
                0.68,
                split('s5', 'vertical', 0.5, leaf('n4', 'bedroom'), leaf('n5', 'bedroom')),
                split('s6', 'horizontal', 0.62, leaf('n6', 'bedroom'), leaf('n7', 'bathroom')),
              ),
            ),
          ),
        },
      ],
    },
  },
  {
    name: 'Ikki qavatli — 3 yotoqxona',
    floors: 2,
    tagBedrooms: [3],
    tagStyles: [],
    minWidth: 9,
    maxWidth: 15,
    minLength: 10,
    maxLength: 16,
    tree: {
      floors: [
        {
          // Birinchi qavat: kunduzgi zona va kirish xonasi.
          level: 1,
          tree: split(
            's1',
            'horizontal',
            0.6,
            split('s2', 'vertical', 0.6, leaf('n1', 'living'), leaf('n2', 'kitchen')),
            split(
              's3',
              'vertical',
              0.45,
              leaf('n3', 'hall'),
              split('s4', 'vertical', 0.55, leaf('n4', 'dining'), leaf('n5', 'bathroom')),
            ),
          ),
        },
        {
          // Ikkinchi qavat: koridor o'rtada — uch yotoqxona ham unga tegadi.
          level: 2,
          tree: split(
            's1',
            'horizontal',
            0.42,
            split('s2', 'vertical', 0.5, leaf('n1', 'bedroom'), leaf('n2', 'bedroom')),
            split(
              's3',
              'horizontal',
              0.28,
              leaf('n3', 'corridor'),
              split('s4', 'vertical', 0.75, leaf('n4', 'bedroom'), leaf('n5', 'bathroom')),
            ),
          ),
        },
      ],
    },
  },
];

const FAQ = [
  {
    category: 'general',
    question: t('Loyiha qancha vaqtda tayyor bo\'ladi?', 'Сколько времени занимает проект?', 'How long does a project take?'),
    answer: t(
      'Parametrlarni kiritganingizdan so\'ng bir necha soniyada tayyor bo\'ladi.',
      'Проект готов за несколько секунд после ввода параметров.',
      'It is ready within seconds after you enter the parameters.',
    ),
    sort: 1,
  },
  {
    category: 'estimate',
    question: t('Smeta aniqmi?', 'Насколько точна смета?', 'How accurate is the estimate?'),
    answer: t(
      'Smeta haqiqiy geometriyadan hisoblanadi, lekin bu taxminiy hisob-kitob — yakuniy narx emas. Qurilishga kirishishdan oldin mutaxassis bilan tekshiring.',
      'Смета рассчитывается по реальной геометрии, но это ориентировочный расчёт, а не окончательная цена.',
      'The estimate is computed from real geometry, but it is an approximation, not a final price.',
    ),
    sort: 2,
  },
  {
    category: 'editing',
    question: t('Xona qo\'sha olamanmi?', 'Можно ли добавить комнату?', 'Can I add a room?'),
    answer: t(
      'Ha. Xona qo\'shsangiz yoki olib tashlasangiz, 2D reja, 3D model va smeta birdan qayta hisoblanadi.',
      'Да. При добавлении или удалении комнаты план, 3D-модель и смета пересчитываются сразу.',
      'Yes. Adding or removing a room rebuilds the plan, the 3D model and the estimate at once.',
    ),
    sort: 3,
  },
];

async function main() {
  console.info('seeding ArchAI…');

  /**
   * Seed qiymatlarini majburan tiklash.
   *
   * Sukut bo'yicha urug' MAVJUD qatorlarga tegmaydi — u faqat
   * yetishmayotganini qo'shadi. Admin tahrirlaydigan har bir jadval
   * uchun shu qoida amal qiladi.
   */
  const forceCatalog = process.argv.includes('--force-catalog');

  // --- Xona turlari ------------------------------------------------------
  /*
   * Mavjud qatorlar TEGILMAYDI.
   *
   * Xona qoidalari ham admin tahrirlaydigan ma'lumot: `minArea` ni 9
   * dan 14 ga o'zgartirish bundan keyin yaratiladigan hamma uyni
   * o'zgartiradi. Ilgari bu yerda `update: roomType` turardi va
   * urug'ni qayta yurgizish
   * adminning butun ishini jimgina qaytarib tashlardi — narxlar bilan
   * aynan bir xil muammo (Faza 0.1).
   */
  let newRoomTypes = 0;
  for (const roomType of ROOM_TYPES) {
    const existing = await prisma.roomType.findUnique({ where: { code: roomType.code } });
    if (!existing) newRoomTypes += 1;

    await prisma.roomType.upsert({
      where: { code: roomType.code },
      update: forceCatalog ? roomType : {},
      create: roomType,
    });
  }
  console.info(`  room types: ${ROOM_TYPES.length} (${newRoomTypes} yangi)`);

  // --- Uslublar ----------------------------------------------------------
  // Xona turlaridagi bilan bir xil sabab: uslublar ham admin
  // tahrirlaydigan ma'lumot va urug' ularni bosib o'tmasligi kerak.
  let newStyles = 0;
  for (const style of STYLES) {
    const existing = await prisma.style.findUnique({ where: { slug: style.slug } });
    if (!existing) newStyles += 1;

    await prisma.style.upsert({
      where: { slug: style.slug },
      update: forceCatalog ? { ...style, status: CONTENT_STATUS.PUBLISHED } : {},
      create: { ...style, status: CONTENT_STATUS.PUBLISHED },
    });
  }
  console.info(`  styles: ${STYLES.length} (${newStyles} yangi)`);

  // --- Narx bazasi -------------------------------------------------------
  //
  // DIQQAT: bu yerda `update` ATAYLAB bo'sh. Narxlar admin panelidan
  // tahrirlanadi, va `update: item` yozilsa har `db:seed` adminning butun
  // ishini jimgina seed qiymatlariga qaytarib yuboradi. Mavjud qatorlar
  // tegilmaydi — faqat yangi kodlar qo'shiladi.
  //
  // Seed qiymatlarini ataylab tiklash kerak bo'lsa: `db:seed --force-prices`.
  const forcePrices = process.argv.includes('--force-prices');
  let priceCreated = 0;

  for (const item of PRICE_ITEMS) {
    const result = await prisma.priceItem.upsert({
      where: { code: item.code },
      update: forcePrices ? item : {},
      create: item,
    });
    if (result.createdAt.getTime() === result.updatedAt.getTime()) priceCreated += 1;
  }

  /**
   * Material variantlari.
   *
   * Ular `price_items` ga bog'langani uchun avval ish turlari yozilishi
   * shart — yuqorida shunday. Mavjud variantning narxi tegilmaydi:
   * admin uni o'zgartirgan bo'lishi mumkin.
   */
  let optionCreated = 0;

  for (const option of PRICE_OPTIONS) {
    const item = await prisma.priceItem.findUnique({ where: { code: option.item } });
    if (!item) {
      console.warn(`  ! "${option.item}" ish turi topilmadi — "${option.code}" o'tkazib yuborildi`);
      continue;
    }

    const { item: _itemCode, ...fields } = option;

    const result = await prisma.priceOption.upsert({
      where: { priceItemId_code: { priceItemId: item.id, code: option.code } },
      update: forcePrices ? fields : {},
      create: { ...fields, priceItemId: item.id },
    });

    if (result.createdAt.getTime() === result.updatedAt.getTime()) optionCreated += 1;
  }

  /**
   * Pardoz to'plamlari.
   *
   * Bu yerda `update: {}` yetarli emas. `defaults` ustuni keyinroq
   * qo'shilgan va mavjud qatorlarda u bo'sh `{}` bo'lib qolgan — ya'ni
   * "adminning tahriri" emas, shunchaki to'ldirilmagan joy. Bo'sh
   * bo'lsa to'ldiramiz, to'ldirilgan bo'lsa tegmaymiz.
   */
  for (const level of FINISH_LEVELS) {
    const existing = await prisma.finishLevel.findUnique({ where: { code: level.code } });
    const isEmpty = !existing || Object.keys((existing.defaults ?? {}) as object).length === 0;

    await prisma.finishLevel.upsert({
      where: { code: level.code },
      update: forcePrices || isEmpty ? level : {},
      create: level,
    });
  }

  console.info(
    `  price items: ${PRICE_ITEMS.length} (${priceCreated} yangi), ` +
      `materiallar: ${PRICE_OPTIONS.length} (${optionCreated} yangi), ` +
      `pardoz darajalari: ${FINISH_LEVELS.length}` +
      (forcePrices ? ' — MAJBURIY TIKLANDI' : ''),
  );

  // --- Tom uslublari -----------------------------------------------------
  //
  // Narxlardan KEYIN turadi: har bir preset qoplama materialiga havola
  // qiladi va u `price_options` da bo'lishi kerak.
  let newRoofStyles = 0;
  for (const roofStyle of ROOF_STYLES) {
    const { covering, ...fields } = roofStyle;

    const option = await prisma.priceOption.findFirst({
      where: { code: covering, item: { code: 'roof_cover' } },
      select: { id: true },
    });

    const existing = await prisma.roofStyle.findUnique({ where: { code: fields.code } });
    if (!existing) newRoofStyles += 1;

    const data = {
      ...fields,
      coveringId: option?.id ?? null,
      status: CONTENT_STATUS.PUBLISHED,
    };

    await prisma.roofStyle.upsert({
      where: { code: fields.code },
      update: forceCatalog ? data : {},
      create: data,
    });
  }
  console.info(`  tom uslublari: ${ROOF_STYLES.length} (${newRoofStyles} yangi)`);

  // Uslublarni presetga bog'laymiz — faqat hali bog'lanmaganlarini,
  // shunda admin qo'lda qo'ygan bog'lanish buzilmaydi.
  for (const [slug, roofCode] of Object.entries(STYLE_ROOFS)) {
    const preset = await prisma.roofStyle.findUnique({ where: { code: roofCode } });
    if (!preset) continue;

    await prisma.style.updateMany({
      where: { slug, roofStyleId: null },
      data: { roofStyleId: preset.id },
    });
  }

  // --- Skeletlar ---------------------------------------------------------
  for (const skeleton of SKELETONS) {
    const existing = await prisma.skeleton.findFirst({ where: { name: skeleton.name } });

    const data = {
      ...skeleton,
      tree: skeleton.tree as unknown as object,
      status: CONTENT_STATUS.PUBLISHED,
    };

    /*
     * Mavjud andozalar TEGILMAYDI.
     *
     * Faza 8 dan boshlab andozalarni admin tahrirlaydi — daraxtni
     * o'zgartiradi, chegaralarni sozlaydi. Bu yerda avval shartsiz
     * `update` turardi, ya'ni urug'ni qayta yurgizish uning butun
     * ishini jimgina bekor qilardi. Narxlar va xona turlari bilan
     * bir xil qoida.
     */
    if (existing) {
      if (forceCatalog) await prisma.skeleton.update({ where: { id: existing.id }, data });
    } else {
      await prisma.skeleton.create({ data });
    }
  }
  console.info(`  skeletons: ${SKELETONS.length}`);

  // --- Tariflar ----------------------------------------------------------
  for (const plan of PLANS) {
    await prisma.plan.upsert({ where: { code: plan.code }, update: plan, create: plan });
  }
  console.info(`  plans: ${PLANS.length}`);

  // --- FAQ ---------------------------------------------------------------
  const existingFaq = await prisma.faqItem.count();
  if (existingFaq === 0) {
    await prisma.faqItem.createMany({ data: FAQ });
    console.info(`  faq: ${FAQ.length}`);
  }

  // --- Admin -------------------------------------------------------------
  const adminEmail = process.env.SEED_ADMIN_EMAIL || 'admin@archai.uz';
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'admin12345';

  await prisma.user.upsert({
    where: { email: adminEmail },
    update: { role: USER_ROLE.ADMIN },
    create: {
      fullName: 'ArchAI Admin',
      email: adminEmail,
      password: await hashPassword(adminPassword),
      role: USER_ROLE.ADMIN,
      emailVerified: true,
    },
  });
  console.info(`  admin: ${adminEmail}`);

  console.info('done.');
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
