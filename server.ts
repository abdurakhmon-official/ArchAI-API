import { config as configDotEnv } from 'dotenv';
configDotEnv();

import { Configuration, Inject } from '@tsed/di';
import { PlatformApplication } from '@tsed/common';
import '@tsed/platform-express'; // /!\ keep this import
import '@tsed/ajv';
import '@tsed/swagger';
import * as controllers from './controllers';
import { Application, json, urlencoded } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import compression from 'compression';
import hpp from 'hpp';
import cookieParser from 'cookie-parser';
import config from '@/config';
import bearerToken from 'express-bearer-token';
import { logging } from './middlewares/logging.middleware';
import { get404 } from './middlewares/404.middleware';
// Importing the filter is what registers it — `componentsScan` is off.
import './middlewares/error.middleware';

const API_ROOT = config.apiRoot;

const corsOrigin = config.cors.origin === '*' ? true : config.cors.origin.split(',').map((origin: string) => origin.trim());

@Configuration({
  acceptMimes: ['application/json'],
  httpPort: config.port,
  httpsPort: false,
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
                "REST API for EduTest: an online test platform for teachers — profiles, tests, questions and results.\n\n" +
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
    // Required for `secure` cookies and correct client IPs behind a proxy.
    this.app.rawApp.set('trust proxy', 1);

    // Express 5 defaults to the `simple` query parser, which cannot decode the
    // nested syntax the list endpoints rely on
    // (`?sortBy[0][key]=created_at&sortBy[0][order]=desc`). Without `extended`
    // those params arrive as flat, unusable keys and sorting silently falls back
    // to the default.
    this.app.rawApp.set('query parser', 'extended');

    this.app.use(hpp());
    this.app.use(
      helmet({
        contentSecurityPolicy: false, // not needed in api context
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

    // Anything that reached this point matched no route. Errors never do —
    // they are handled by GlobalErrorFilter.
    this.app.use(get404());
  }
}
