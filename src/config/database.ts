import { PrismaClient } from '@prisma/client';
import { env } from './env';

// Prevent multiple instances in development due to hot reloading
const globalForPrisma = global as unknown as { prisma: PrismaClient };

export const getPrismaClient = (): PrismaClient => {
  if (!globalForPrisma.prisma) {
    globalForPrisma.prisma = new PrismaClient({});
  }
  return globalForPrisma.prisma;
};

export const connectDB = async () => {
  try {
    const prisma = getPrismaClient();
    await prisma.$connect();
    console.log('✅ Database connected successfully');
  } catch (error) {
    console.error('❌ Database connection failed:', error);
    process.exit(1);
  }
};
