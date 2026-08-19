import type { Locale } from '@/i18n/locales';

/**
 * Mail wording, one entry per locale.
 *
 * The queue already carried `locale` but the processor ignored it, so
 * every account received Uzbek. The link was worse than the wording:
 * paths are localised in the web app, and a Russian reader was sent to
 * `/ru/parol-tiklash/…`, which does not exist — the reset link simply
 * did not work for them.
 */

type Template = 'welcome' | 'verify' | 'reset' | 'subscription';

interface Copy {
  subject: string;
  heading: string;
  /** Paragraphs, in order. */
  body: string[];
  action: string;
  note?: string;
}

/** Web-app paths, per locale. Mirrors `ui/i18n/routing.ts`. */
const PATHS: Record<Locale, Record<Template, string>> = {
  uz: {
    welcome: '/konstruktor',
    verify: '/email-tasdiqlash',
    reset: '/parol-tiklash',
    subscription: '/kabinet/obuna',
  },
  ru: {
    welcome: '/konstruktor',
    verify: '/podtverzhdenie-email',
    reset: '/sbros-parolya',
    subscription: '/kabinet/podpiska',
  },
  en: {
    welcome: '/constructor',
    verify: '/verify-email',
    reset: '/reset-password',
    subscription: '/dashboard/subscription',
  },
};

const COPY: Record<Locale, Record<Template, Copy>> = {
  uz: {
    welcome: {
      subject: 'ArchAI ga xush kelibsiz',
      heading: 'Xush kelibsiz',
      body: [
        "Endi bir necha daqiqada uy loyihasini yaratishingiz mumkin — yer maydoni, o'lcham va xona sonini kiriting, qolganini tizim qiladi.",
      ],
      action: 'Loyiha yaratish',
    },
    verify: {
      subject: 'Email manzilingizni tasdiqlang',
      heading: 'Bitta qadam qoldi',
      body: ['Email manzilingizni tasdiqlash uchun quyidagi tugmani bosing. Havola 24 soat amal qiladi.'],
      action: 'Tasdiqlash',
      note: "Agar siz ro'yxatdan o'tmagan bo'lsangiz, bu xatni e'tiborsiz qoldiring.",
    },
    reset: {
      subject: 'Parolni tiklash',
      heading: 'Parolni tiklash',
      body: ["Yangi parol o'rnatish uchun quyidagi tugmani bosing. Havola 1 soat amal qiladi."],
      action: "Yangi parol o'rnatish",
      note: "Agar siz so'ramagan bo'lsangiz, parolingiz o'zgarmaydi — bu xatni e'tiborsiz qoldiring.",
    },
    subscription: {
      subject: 'Obunangiz haqida',
      heading: 'Obuna yangilandi',
      body: [],
      action: "Obunani ko'rish",
    },
  },

  ru: {
    welcome: {
      subject: 'Добро пожаловать в ArchAI',
      heading: 'Добро пожаловать',
      body: [
        'Теперь проект дома можно собрать за несколько минут — укажите площадь участка, размеры и число комнат, остальное сделает система.',
      ],
      action: 'Создать проект',
    },
    verify: {
      subject: 'Подтвердите адрес почты',
      heading: 'Остался один шаг',
      body: ['Нажмите кнопку ниже, чтобы подтвердить адрес. Ссылка действует 24 часа.'],
      action: 'Подтвердить',
      note: 'Если вы не регистрировались, просто не отвечайте на это письмо.',
    },
    reset: {
      subject: 'Восстановление пароля',
      heading: 'Восстановление пароля',
      body: ['Нажмите кнопку ниже, чтобы задать новый пароль. Ссылка действует 1 час.'],
      action: 'Задать новый пароль',
      note: 'Если вы не запрашивали смену, пароль останется прежним — письмо можно не читать.',
    },
    subscription: {
      subject: 'О вашей подписке',
      heading: 'Подписка обновлена',
      body: [],
      action: 'Открыть подписку',
    },
  },

  en: {
    welcome: {
      subject: 'Welcome to ArchAI',
      heading: 'Welcome',
      body: [
        'A house plan now takes a few minutes — enter the plot area, the dimensions and the room count, and the rest is worked out for you.',
      ],
      action: 'Create a project',
    },
    verify: {
      subject: 'Confirm your email address',
      heading: 'One step left',
      body: ['Press the button below to confirm your address. The link is valid for 24 hours.'],
      action: 'Confirm',
      note: 'If you did not sign up, you can ignore this message.',
    },
    reset: {
      subject: 'Reset your password',
      heading: 'Reset your password',
      body: ['Press the button below to set a new password. The link is valid for 1 hour.'],
      action: 'Set a new password',
      note: 'If you did not ask for this, your password stays as it is — you can ignore this message.',
    },
    subscription: {
      subject: 'About your subscription',
      heading: 'Subscription updated',
      body: [],
      action: 'View subscription',
    },
  },
};

/** Extra lines the subscription mail adds from the job payload. */
const SUBSCRIPTION_LABELS: Record<Locale, { plan: string; expires: string }> = {
  uz: { plan: 'Tarif', expires: 'Amal qilish muddati' },
  ru: { plan: 'Тариф', expires: 'Действует до' },
  en: { plan: 'Plan', expires: 'Valid until' },
};

const copyFor = (locale: Locale, template: Template): Copy => COPY[locale][template];
const pathFor = (locale: Locale, template: Template): string => `/${locale}${PATHS[locale][template]}`;
const labelsFor = (locale: Locale) => SUBSCRIPTION_LABELS[locale];

export { copyFor, pathFor, labelsFor };
export type { Template, Copy };
