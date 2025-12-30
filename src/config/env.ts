import { z } from 'zod';
import * as dotenv from 'dotenv';

dotenv.config();

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'production', 'test']).default('development'),
  PORT: z.string().default('3000'),
  DATABASE_URL: z.string().min(1),
  REDIS_URL: z.string().min(1),
  BASE_RPC_URL: z.string().url(),
  JWT_SECRET: z.string().min(8),
});

export const env = envSchema.parse(process.env);
