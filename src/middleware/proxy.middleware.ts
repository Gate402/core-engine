import { Request, Response, NextFunction } from 'express';
import { ProxyService } from '../services/proxy.service';
import type { X402Service } from '../services/x402.service';

// Custom interface to attach gateway to request
declare global {
  namespace Express {
    interface Request {
      gateway?: any;
      paymentInfo?: any;
    }
  }
}

export const createProxyMiddleware = (x402Service: X402Service) => {
  const proxyService = new ProxyService(x402Service);

  return async (req: Request, res: Response, next: NextFunction) => {
    return proxyService.handleRequest(req, res, next);
  };
};
