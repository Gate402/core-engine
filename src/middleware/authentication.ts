import { Request } from 'express';
import jwt from 'jsonwebtoken';
import { UnauthorizedError } from '../utils/errors';

const JWT_SECRET = process.env.JWT_SECRET || 'secret';

/**
 * tsoa authentication handler
 * Called by tsoa when @Security('jwt') decorator is used
 */
export async function expressAuthentication(
  request: Request,
  securityName: string,
  _scopes?: string[],
): Promise<{ userId: string; email: string }> {
  if (securityName === 'jwt') {
    const authHeader = request.headers.authorization;

    if (!authHeader) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      throw new UnauthorizedError('Invalid authorization header format');
    }

    try {
      const payload = jwt.verify(token, JWT_SECRET) as any;
      return {
        userId: payload.userId,
        email: payload.email,
      };
    } catch (error) {
      throw new UnauthorizedError('Invalid token');
    }
  }

  throw new UnauthorizedError('Unknown security method');
}

