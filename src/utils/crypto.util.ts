import { createPublicClient, http, parseAbiItem } from 'viem';
import { base } from 'viem/chains';
import prisma from '../config/database';
import redis from '../config/redis';
import { env } from '../config/env';
import * as crypto from 'crypto';

export const generateSecretToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateGatewayId = (): string => {
  return crypto.randomUUID();
};
