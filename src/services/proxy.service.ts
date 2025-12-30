import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { GatewayService } from './gateway.service';
import { PaymentService } from './payment.service';
import { AnalyticsService } from './analytics.service';

export class ProxyService {
  private gatewayService: GatewayService;
  private paymentService: PaymentService;
  private analyticsService: AnalyticsService;

  constructor() {
    this.gatewayService = new GatewayService();
    this.paymentService = new PaymentService();
    this.analyticsService = new AnalyticsService();
  }

  public async handleRequest(req: Request, res: Response, next: NextFunction) {
    const hostname = req.hostname;

    // 1. Identify Gateway
    const gateway = await this.gatewayService.resolveGateway(hostname);

    if (!gateway) {
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
        const payment = await this.paymentService.verifyPayment(paymentProof, gateway.id);
        paymentValid = true;
        paymentId = payment.id;
        req.paymentInfo = payment;
      } catch (err: any) {
        paymentError = err.message;
      }
    }

    // 3. Prepare Log Data
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
      clientWallet: req.paymentInfo?.fromWallet,
    };

    // 4. Enforce Payment
    if (!paymentValid) {
      // Log failure
      this.analyticsService.logRequest({
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

    // 5. Proxy Request
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
            proxyReq.setHeader('X-Forwarded-For', req.ip);
          }
        },
        proxyRes: (proxyRes, req: any, res) => {
          // Log success after response
          this.analyticsService.logRequest({
            ...logData,
            statusCode: proxyRes.statusCode || 200,
            durationMs: Date.now() - startTime,
          });
        },
        error: (err, req, res) => {
          console.error('Proxy Error:', err);
          this.analyticsService.logRequest({
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
  }
}
