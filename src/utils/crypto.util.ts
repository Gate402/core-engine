import * as crypto from 'crypto';

export const generateSecretToken = (): string => {
  return crypto.randomBytes(32).toString('hex');
};

export const generateGatewayId = (): string => {
  return crypto.randomUUID();
};
