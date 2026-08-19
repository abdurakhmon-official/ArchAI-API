import { PrismaClient } from '../generated/prisma/client';

if (!global.__db) {
  global.__db = new PrismaClient({
    log: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
  });
}

export default global.__db;
