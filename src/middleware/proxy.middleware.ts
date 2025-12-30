import { Request, Response, NextFunction } from 'express';
import { ProxyService } from '../services/proxy.service';

const proxyService = new ProxyService();

// Custom interface to attach gateway to request
declare global {
  namespace Express {
    interface Request {
      gateway?: any;
      paymentInfo?: any;
    }
  }
}

export const proxyMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  return proxyService.handleRequest(req, res, next);
};
