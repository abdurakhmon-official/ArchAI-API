import merge from 'lodash.merge';
import { config as loadDotEnv } from 'dotenv';

loadDotEnv();

process.env.NODE_ENV = process.env.NODE_ENV || 'development';
process.env.STAGE = process.env.STAGE || 'local';

let envConfig;

if (process.env.STAGE === 'production') {
  envConfig = require('./prod').default;
} else if (process.env.STAGE === 'testing') {
  envConfig = require('./testing').default;
} else {
  envConfig = require('./local').default;
}

const required = (name: string): string => process.env[name] || '';

const config = merge(
  {
    stage: process.env.STAGE || 'local',
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3000,
    apiRoot: '/api',
    jwt: {
      secret: required('JWT_SECRET'),
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    },
    billingSecret: process.env.BILLING_SECRET || '',
    secrets: {
      jwt: process.env.JWT_SECRET,
      dbURL: required('DATABASE_URL'),
    },
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: process.env.CREDENTIALS || true,
    },
    swagger: {
      enabled: process.env.SWAGGER_ENABLED !== 'false',
      path: process.env.SWAGGER_PATH || '/docs',
    },
    webUrl: process.env.WEB_URL || 'http://localhost:3001',
    publicUrl: process.env.PUBLIC_URL || '',
    redis: {
      url: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
    },

    AWS_REGION: process.env.AWS_REGION || 'eu-central-1',
    AWS_S3_BUCKET: process.env.AWS_S3_BUCKET || '',
    AWS_ACCESS_KEY_ID: process.env.AWS_ACCESS_KEY_ID || '',
    AWS_SECRET_ACCESS_KEY: process.env.AWS_SECRET_ACCESS_KEY || '',
    AWS_FILE_VIEW_EXPIRY_SECONDS: Number(process.env.AWS_FILE_VIEW_EXPIRY) || 3600,

    mail: {
      host: process.env.MAIL_HOST || '',
      port: Number(process.env.MAIL_PORT) || 587,
      user: process.env.MAIL_USER || '',
      password: process.env.MAIL_PASSWORD || '',
      from: process.env.MAIL_FROM || 'ArchAI <no-reply@archai.uz>',
    },

    payments: {
      payme: {
        merchantId: process.env.PAYME_MERCHANT_ID || '',
        secretKey: process.env.PAYME_SECRET_KEY || '',
      },
      click: {
        merchantId: process.env.CLICK_MERCHANT_ID || '',
        serviceId: process.env.CLICK_SERVICE_ID || '',
        secretKey: process.env.CLICK_SECRET_KEY || '',
      },
      stripe: {
        secretKey: process.env.STRIPE_SECRET_KEY || '',
        webhookSecret: process.env.STRIPE_WEBHOOK_SECRET || '',
      },
    },
  },
  envConfig,
);

if (!config.publicUrl) {
  config.publicUrl = `http://localhost:${config.port}`;
}

export const publicApiUrl = `${config.publicUrl.replace(/\/$/, '')}${config.apiRoot}`;

export default { ...config, publicApiUrl };
