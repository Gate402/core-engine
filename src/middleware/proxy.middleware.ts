import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware, Options } from 'http-proxy-middleware';
import { GatewayService } from '../services/gateway.service';
import { PaymentService } from '../services/payment.service';
import { AnalyticsService } from '../services/analytics.service';
import prisma from '../config/database'; // Direct access for logging if needed
import { extractSubdomain } from '../utils/subdomain.util';

const gatewayService = new GatewayService();
const paymentService = new PaymentService();
const analyticsService = new AnalyticsService();

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
  const hostname = req.hostname;

  // 1. Identify Gateway
  // We check if it's a subdomain or custom domain
  const gateway = await gatewayService.resolveGateway(hostname);

  if (!gateway) {
    // Not a valid gateway, maybe 404 or pass to next (if handling other routes)
    // But this middleware is supposed to run on *.gate402.io...
    // If we are hitting /api/*, that should be handled BEFORE this middleware in index.ts
    // If we are here, it's a proxy request.
    return res.status(404).send('Gateway not found');
  }

  req.gateway = gateway;

  // 2. Check Payment Logic
  const paymentProof = req.headers['x402-payment'] as string;
  let paymentValid = false;
  let paymentId = undefined;
  let paymentError = null;

  if (paymentProof) {
    try {
      const payment = await paymentService.verifyPayment(paymentProof, gateway.id);
      paymentValid = true;
      paymentId = payment.id;
      req.paymentInfo = payment;
    } catch (err: any) {
      paymentError = err.message;
    }
  }

  // 3. Enforce Payment
  // Determine if we need to block.
  // ALWAYS block if no valid payment.
  // Unless we want to support "free tier"? No, instructions say strict 402.

  // Log the attempt (Async)
  const startTime = Date.now();
  const logData = {
    gatewayId: gateway.id,
    method: req.method,
    path: req.path,
    statusCode: paymentValid ? 200 : 402, // Provisional
    paymentRequired: true,
    paymentProvided: !!paymentProof,
    paymentValid: paymentValid,
    paymentId: paymentId,
    clientIp: req.ip,
    // clientWallet: extract from payment if valid?
    clientWallet: req.paymentInfo?.fromWallet,
  };

  if (!paymentValid) {
    // Log failure
    analyticsService.logRequest({
      ...logData,
      statusCode: 402,
      durationMs: Date.now() - startTime,
    });
    return res.status(402).json({
      error: 'Payment Required',
      message: paymentError || 'Missing or invalid x402-payment header',
      details: {
        price: gateway.pricePerRequest,
        currency: 'USDC',
        networks: gateway.acceptedNetworks,
        recipient: gateway.user?.payoutWallet,
      },
    });
  }

  // 4. Proxy Request
  // We use http-proxy-middleware to forward.
  // Since this is an express middleware, we can just call the proxy function.

  const proxy = createProxyMiddleware({
    target: gateway.originUrl,
    changeOrigin: true,
    pathRewrite: (path, req) => {
      return path; // Keep path as is
    },
    on: {
      proxyReq: (proxyReq, req: any, res) => {
        // Add headers
        proxyReq.setHeader('X-Gate402-Secret', gateway.secretToken);
        if (req.ip) {
          // Check if req.ip is present
          proxyReq.setHeader('X-Forwarded-For', req.ip);
        }
        // Host header is automatically handled by changeOrigin: true?
        // "removes the 'Host' header" -> http-proxy-middleware handles host rewrite.
      },
      proxyRes: (proxyRes, req: any, res) => {
        // Log success after response
        analyticsService.logRequest({
          ...logData,
          statusCode: proxyRes.statusCode || 200,
          durationMs: Date.now() - startTime,
        });
      },
      error: (err, req, res) => {
        console.error('Proxy Error:', err);
        analyticsService.logRequest({
          ...logData,
          statusCode: 502,
          durationMs: Date.now() - startTime,
        });

        // res is http.ServerResponse, not Express.Response here strictly speaking in types
        (res as any).writeHead(502, { 'Content-Type': 'text/plain' });
        (res as any).end('Bad Gateway');
      },
    },
  });

  proxy(req, res, next);
};
