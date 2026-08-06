import { PrismaClient, User } from '@/generated/prisma';
import { AccessTokenPayload } from '@/modules/auth';

export type AuthenticatedUser = Omit<User, 'password'> & {
  isAdmin: boolean;
};

declare global {
  var __db: PrismaClient;

  namespace Express {
    export interface Request {
      token?: string;
      user?: AuthenticatedUser;
      auth?: AccessTokenPayload;
    }
  }

  namespace NodeJS {
    interface ProcessEnv {
      NODE_ENV?: string;
      PORT?: string;
      STAGE?: string;
      JWT_SECRET: string;
      JWT_EXPIRES_IN?: string;
      DATABASE_URL: string;
      CORS_ORIGIN?: string;
      SWAGGER_ENABLED?: string;
      SWAGGER_PATH?: string;
    }
  }
}
