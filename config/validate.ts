import config from '@/config';

interface Check {
  level: 'error' | 'warn';
  message: string;
  fatal?: boolean;
}

const REQUIRED_ENV = ['JWT_SECRET', 'DATABASE_URL'] as const;

const WEAK_SECRETS = [
  'change-me-to-a-long-random-string',
  'secret',
  'jwtsecret',
  'changeme',
  'test',
];

const MIN_SECRET_LENGTH = 32;

export function validateConfig(): Check[] {
  const checks: Check[] = [];
  const isProduction = config.stage === 'production';

  for (const name of REQUIRED_ENV) {
    if (!process.env[name]) {
      checks.push({
        level: 'error',
        fatal: true,
        message: `${name} is not set — copy .env.sample to .env and fill it in`,
      });
    }
  }

  const secret = config.jwt.secret ?? '';

  if (secret) {
    if (WEAK_SECRETS.includes(secret.toLowerCase())) {
      checks.push({ level: 'error', message: 'JWT_SECRET still holds the sample value' });
    } else if (secret.length < MIN_SECRET_LENGTH) {
      checks.push({
        level: isProduction ? 'error' : 'warn',
        message: `JWT_SECRET is too short (${secret.length} characters, ${MIN_SECRET_LENGTH} required)`,
      });
    }
  }

  const billingSecret = config.billingSecret ?? '';

  if (!billingSecret) {
    checks.push({
      level: isProduction ? 'error' : 'warn',
      fatal: isProduction,
      message: 'BILLING_SECRET is not set — payout card changes cannot be authorized',
    });
  } else if (billingSecret.length < MIN_SECRET_LENGTH) {
    checks.push({
      level: isProduction ? 'error' : 'warn',
      message: `BILLING_SECRET is too short (${billingSecret.length} characters, ${MIN_SECRET_LENGTH} required)`,
    });
  }

  if (isProduction && config.cors.origin === '*') {
    checks.push({
      level: 'error',
      message: 'CORS_ORIGIN cannot be `*` in production — name the exact domain',
    });
  }

  if (isProduction && config.swagger.enabled) {
    checks.push({
      level: 'warn',
      message: 'Swagger production\'da ochiq — SWAGGER_ENABLED=false qo\'yish tavsiya etiladi',
    });
  }

  if (!config.AWS_S3_BUCKET) {
    checks.push({
      level: isProduction ? 'error' : 'warn',
      message: 'AWS_S3_BUCKET sozlanmagan — fayllar diskka yoziladi va konteyner almashsa yo\'qoladi',
    });
  }

  if (isProduction && config.AWS_ACCESS_KEY_ID) {
    checks.push({
      level: 'warn',
      message: 'AWS kalitlari muhit o\'zgaruvchisida — EC2 da IAM rol ishlatish xavfsizroq',
    });
  }

  if (isProduction && !config.mail.host) {
    checks.push({
      level: 'warn',
      message: 'MAIL_HOST is not set — password reset and verification mail will not be sent',
    });
  }

  if (isProduction && !config.redis.url.includes('://')) {
    checks.push({ level: 'error', message: 'REDIS_URL noto\'g\'ri formatda' });
  }

  const providers = [
    ['Payme', config.payments.payme.secretKey],
    ['Click', config.payments.click.secretKey],
    ['Stripe', config.payments.stripe.secretKey],
  ] as const;

  const configured = providers.filter(([, key]) => Boolean(key));

  if (isProduction && configured.length === 0) {
    checks.push({
      level: 'warn',
      message: 'Birorta to\'lov provayderi sozlanmagan — pulli tariflar ishlamaydi',
    });
  }

  if (config.payments.stripe.secretKey && !config.payments.stripe.webhookSecret) {
    checks.push({
      level: 'error',
      message: 'STRIPE_SECRET_KEY is set but STRIPE_WEBHOOK_SECRET is missing — payments will not be confirmed',
    });
  }

  if (isProduction && config.webUrl.includes('localhost')) {
    checks.push({ level: 'error', message: 'WEB_URL hali localhost\'ga ishora qilyapti' });
  }

  return checks;
}

export function assertConfig(): void {
  const checks = validateConfig();
  if (checks.length === 0) return;

  const errors = checks.filter((check) => check.level === 'error');
  const warnings = checks.filter((check) => check.level === 'warn');

  for (const warning of warnings) {
    console.warn(`[config] ogohlantirish: ${warning.message}`);
  }

  for (const error of errors) {
    console.error(`[config] XATO: ${error.message}`);
  }

  const hasFatal = errors.some((check) => check.fatal);

  if (errors.length > 0 && (config.stage === 'production' || hasFatal)) {
    console.error(
      `\n[config] ${errors.length} ta jiddiy muammo tufayli server ishga tushmadi.\n` +
        'Sozlamalarni to\'g\'rilab, qayta urinib ko\'ring.\n',
    );
    process.exit(1);
  }
}
