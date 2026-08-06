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

const required = (name: string): string => {
  const value = process.env[name];

  if (!value) {
    throw new Error(`missing required environment variable: ${name}. copy .env.sample to .env and fill it in.`);
  }

  return value;
};

export default merge(
  {
    stage: process.env.STAGE || 'local',
    env: process.env.NODE_ENV || 'development',
    port: Number(process.env.PORT) || 3000,
    apiRoot: '/api',
    jwt: {
      secret: required('JWT_SECRET'),
      expiresIn: process.env.JWT_EXPIRES_IN || '1d',
    },
    secrets: {
      jwt: process.env.JWT_SECRET,
      dbURL: required('DATABASE_URL'),
    },
    cors: {
      origin: process.env.CORS_ORIGIN || '*',
      credentials: true,
    },
    swagger: {
      enabled: process.env.SWAGGER_ENABLED !== 'false',
      path: process.env.SWAGGER_PATH || '/docs',
    },
  },
  envConfig,
);
