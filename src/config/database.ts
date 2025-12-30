import { PrismaClient } from '@prisma/client';
import { env } from './env';

// @ts-ignore
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: env.DATABASE_URL,
    },
  },
});

export default prisma;
