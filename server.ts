import { config as configDotEnv } from 'dotenv';
configDotEnv();

import { Configuration, Inject } from '@tsed/di';
import { PlatformApplication } from '@tsed/common';
import '@tsed/platform-express'; 
import '@tsed/ajv';
import '@tsed/swagger';
import * as controllers from './controllers';
import express, { Application, json, urlencoded } from 'express';
import { LOCAL_STORAGE_DIR, storageDriver } from '@/modules/storage';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import config from '@/config';
import bearerToken from 'express-bearer-token';
import { logging } from './middlewares/logging.middleware';
import { get404 } from './middlewares/404.middleware';
import './middlewares/error.middleware';

const API_ROOT = config.apiRoot;

const corsOrigin = config.cors.origin === '*' ? true : config.cors.origin.split(',').map((origin: string) => origin.trim());

@Configuration({
  acceptMimes: ['application/json'],
  httpPort: config.port,
  httpsPort: false,

  httpOptions: { keepAliveTimeout: 65_000, headersTimeout: 66_000 },
  componentsScan: false,
  mount: {
    [API_ROOT]: [...Object.values(controllers)],
  },
  middlewares: [logging()],
  exclude: ['**/*.spec.ts'],
  swagger: config.swagger.enabled
    ? [
        {
          path: config.swagger.path,
          specVersion: '3.0.3',
          spec: {
            info: {
              title: 'EduTest API',
              version: '1.0.0',
              description:
                "REST API for ArchAi: an online test platform for teachers — profiles, tests, questions and results.\n\n" +
                'Sign in through `POST /api/auth/signin`, then press **Authorize** and paste the returned token.',
            },
            components: {
              securitySchemes: {
                bearerAuth: {
                  type: 'http',
                  scheme: 'bearer',
                  bearerFormat: 'JWT',
                },
              },
            },
          },
        },
      ]
    : [],
  logger: {
    disableRoutesSummary: config.env !== 'development',
  },
})
export class Server {
  @Inject()
  protected app!: PlatformApplication<Application>;

  @Configuration()
  protected settings!: Configuration;

  $beforeRoutesInit() {
    this.app.rawApp.set('trust proxy', 1);
    this.app.rawApp.set('query parser', 'extended');

    this.app.use(hpp());
    this.app.use(
      helmet({
        contentSecurityPolicy: false, 
        crossOriginResourcePolicy: false,
      }),
    );
    this.app.use(
      cors({
        origin: corsOrigin,
        credentials: config.cors.credentials,
      }),
    );
    this.app.use(cookieParser());
    this.app.use(compression());

    this.app.use(`${API_ROOT}/webhook/stripe`, express.raw({ type: '*/*', limit: '1mb' }));

    if (storageDriver() === 'local') {
      this.app.use(`${API_ROOT}/static`, express.static(LOCAL_STORAGE_DIR, { maxAge: '1h' }));
    }
    this.app.use(json({ limit: '1mb' }));
    this.app.use(urlencoded({ extended: true }));
    this.app.use(bearerToken());
  }

  $afterRoutesInit() {
    console.info(`======= ENV: ${config.env} =======`);
    console.info(`======= STAGE: ${config.stage} =======`);
    console.info(`App listening on port ${config.port}`);

    if (config.swagger.enabled) {
      console.info(`API documentation on http://localhost:${config.port}${config.swagger.path}`);
    }

    this.app.use(get404());
  }
}
