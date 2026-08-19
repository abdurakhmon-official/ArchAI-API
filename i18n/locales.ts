const LOCALES = ['uz', 'ru', 'en'] as const;

type Locale = (typeof LOCALES)[number];

const DEFAULT_LOCALE: Locale = 'uz';

const isLocale = (value: unknown): value is Locale =>
  typeof value === 'string' && (LOCALES as readonly string[]).includes(value);

/** Falls back rather than throwing: a wrong locale must not stop an email. */
const resolveLocale = (value: unknown): Locale => (isLocale(value) ? value : DEFAULT_LOCALE);

export { LOCALES, DEFAULT_LOCALE, isLocale, resolveLocale };
export type { Locale };
