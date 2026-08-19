import type { Locale } from '@/i18n/locales';

/**
 * PDF wording, one entry per locale.
 *
 * The generator already knew the reader's locale — room, style and
 * material names were translated — but every label around them was
 * fixed Uzbek, so a Russian project came out half in each language.
 */

interface PdfCopy {
  brand: string;
  styleSuffix: string;
  floors: string;
  totalArea: string;
  rooms: string;
  windows: string;
  doors: string;
  roofArea: string;
  estimatedPrice: string;
  metrics: string;
  perimeter: string;
  exteriorWallArea: string;
  interiorWallArea: string;
  foundationVolume: string;
  garage: string;
  terrace: string;
  balcony: string;
  basement: string;
  floorPlan: string;
  room: string;
  area: string;
  share: string;
  estimate: string;
  estimateApproximate: string;
  finishLevel: string;
  perSquareMetre: string;
  accuracy: string;
  workType: string;
  quantity: string;
  unitPrice: string;
  sum: string;
  contingency: string;
  total: string;
  ownPrice: string;
  exact: string;
  partial: string;
  approximate: string;
  watermark: string;
  categories: Record<string, string>;
}

const COPY: Record<Locale, PdfCopy> = {
  uz: {
    brand: 'ArchAI · Uy loyihasi',
    styleSuffix: 'uslubi',
    floors: 'qavat',
    totalArea: 'Umumiy maydon',
    rooms: 'Xonalar',
    windows: 'Derazalar',
    doors: 'Eshiklar',
    roofArea: 'Tom yuzasi',
    estimatedPrice: 'Taxminiy narx',
    metrics: "Qurilish ko'rsatkichlari",
    perimeter: 'Tashqi perimetr',
    exteriorWallArea: 'Tashqi devor yuzasi',
    interiorWallArea: 'Ichki devor yuzasi',
    foundationVolume: 'Poydevor hajmi',
    garage: 'Garaj',
    terrace: 'Terrassa',
    balcony: 'Balkon',
    basement: "Yerto'la",
    floorPlan: 'qavat rejasi',
    room: 'Xona',
    area: 'Maydoni',
    share: 'Ulushi',
    estimate: 'Smeta',
    estimateApproximate: 'Taxminiy smeta',
    finishLevel: 'Pardoz darajasi',
    perSquareMetre: '1 m² uchun',
    accuracy: 'Aniqligi',
    workType: 'Ish turi',
    quantity: 'Miqdori',
    unitPrice: 'Birlik narxi',
    sum: 'Summa',
    contingency: 'Kutilmagan xarajatlar',
    total: 'JAMI',
    ownPrice: "o'z narxingiz",
    exact: 'aniq',
    partial: 'qisman aniq',
    approximate: 'taxminiy',
    watermark: 'ArchAI · namuna',
    categories: {
      FOUNDATION: 'Poydevor',
      WALLS: 'Devorlar',
      ROOF: 'Tom',
      WINDOWS_DOORS: 'Deraza va eshiklar',
      FINISHING: 'Pardoz',
      UTILITIES: 'Muhandislik tizimlari',
      OTHER: "Qo'shimcha hajmlar",
    },
  },

  ru: {
    brand: 'ArchAI · Проект дома',
    styleSuffix: 'стиль',
    floors: 'этажа',
    totalArea: 'Общая площадь',
    rooms: 'Комнаты',
    windows: 'Окна',
    doors: 'Двери',
    roofArea: 'Площадь кровли',
    estimatedPrice: 'Ориентировочная цена',
    metrics: 'Строительные показатели',
    perimeter: 'Наружный периметр',
    exteriorWallArea: 'Площадь наружных стен',
    interiorWallArea: 'Площадь внутренних стен',
    foundationVolume: 'Объём фундамента',
    garage: 'Гараж',
    terrace: 'Терраса',
    balcony: 'Балкон',
    basement: 'Подвал',
    floorPlan: 'этаж — план',
    room: 'Комната',
    area: 'Площадь',
    share: 'Доля',
    estimate: 'Смета',
    estimateApproximate: 'Ориентировочная смета',
    finishLevel: 'Уровень отделки',
    perSquareMetre: 'за 1 m²',
    accuracy: 'Точность',
    workType: 'Вид работ',
    quantity: 'Количество',
    unitPrice: 'Цена за единицу',
    sum: 'Сумма',
    contingency: 'Непредвиденные расходы',
    total: 'ИТОГО',
    ownPrice: 'ваша цена',
    exact: 'точно',
    partial: 'частично точно',
    approximate: 'ориентировочно',
    watermark: 'ArchAI · образец',
    categories: {
      FOUNDATION: 'Фундамент',
      WALLS: 'Стены',
      ROOF: 'Кровля',
      WINDOWS_DOORS: 'Окна и двери',
      FINISHING: 'Отделка',
      UTILITIES: 'Инженерные системы',
      OTHER: 'Дополнительные объёмы',
    },
  },

  en: {
    brand: 'ArchAI · House plan',
    styleSuffix: 'style',
    floors: 'floors',
    totalArea: 'Total area',
    rooms: 'Rooms',
    windows: 'Windows',
    doors: 'Doors',
    roofArea: 'Roof area',
    estimatedPrice: 'Estimated price',
    metrics: 'Building metrics',
    perimeter: 'Exterior perimeter',
    exteriorWallArea: 'Exterior wall area',
    interiorWallArea: 'Interior wall area',
    foundationVolume: 'Foundation volume',
    garage: 'Garage',
    terrace: 'Terrace',
    balcony: 'Balcony',
    basement: 'Basement',
    floorPlan: 'floor plan',
    room: 'Room',
    area: 'Area',
    share: 'Share',
    estimate: 'Estimate',
    estimateApproximate: 'Approximate estimate',
    finishLevel: 'Finish level',
    perSquareMetre: 'per m²',
    accuracy: 'Accuracy',
    workType: 'Work type',
    quantity: 'Quantity',
    unitPrice: 'Unit price',
    sum: 'Sum',
    contingency: 'Contingency',
    total: 'TOTAL',
    ownPrice: 'your own price',
    exact: 'exact',
    partial: 'partly exact',
    approximate: 'approximate',
    watermark: 'ArchAI · sample',
    categories: {
      FOUNDATION: 'Foundation',
      WALLS: 'Walls',
      ROOF: 'Roof',
      WINDOWS_DOORS: 'Windows and doors',
      FINISHING: 'Finishing',
      UTILITIES: 'Utilities',
      OTHER: 'Extra volumes',
    },
  },
};

/** The estimate disclaimer, kept next to the rest of the PDF wording. */
const DISCLAIMER: Record<Locale, string> = {
  uz: 'Bu taxminiy hisob-kitob, yakuniy narx emas. Qurilishga kirishishdan oldin mutaxassis bilan tekshiring.',
  ru: 'Это ориентировочный расчёт, а не итоговая цена. Перед стройкой сверьтесь со специалистом.',
  en: 'This is an estimate, not a final price. Check with a professional before building.',
};

/** Number and date formatting locale. */
const INTL_LOCALE: Record<Locale, string> = { uz: 'uz-UZ', ru: 'ru-RU', en: 'en-GB' };

/** Currency word. The product prices in Uzbek sums everywhere. */
const CURRENCY: Record<Locale, string> = { uz: "so'm", ru: 'сум', en: 'UZS' };

const pdfCopy = (locale: Locale): PdfCopy => COPY[locale];
const pdfDisclaimer = (locale: Locale): string => DISCLAIMER[locale];
const intlLocale = (locale: Locale): string => INTL_LOCALE[locale];
const currency = (locale: Locale): string => CURRENCY[locale];

export { pdfCopy, pdfDisclaimer, intlLocale, currency };
export type { PdfCopy };
