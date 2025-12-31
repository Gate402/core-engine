import { Request, Response, NextFunction } from 'express';
import { createProxyMiddleware } from 'http-proxy-middleware';
import { GatewayService } from './gateway.service';
import { X402Service } from './x402.service';
import { AnalyticsService } from './analytics.service';
import type { PaymentRequirements } from '@x402/core/types';

export class ProxyService {
  private gatewayService: GatewayService;
  private x402Service: X402Service;
  private analyticsService: AnalyticsService;

  constructor(x402Service: X402Service) {
    this.gatewayService = new GatewayService();
    this.x402Service = x402Service;
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

    // 2. Build payment requirements for this gateway
    let requirements: PaymentRequirements;
    try {
      requirements = await this.x402Service.buildPaymentRequirements(gateway);
    } catch (error) {
      console.error('Failed to build payment requirements:', error);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // 3. Check for payment headers (v2: PAYMENT-SIGNATURE, v1: X-PAYMENT)
    const paymentHeader = (req.headers['payment-signature'] || req.headers['x-payment']) as
      | string
      | undefined;

    const startTime = Date.now();
    const logData = {
      gatewayId: gateway.id,
      method: req.method,
      path: req.path,
      statusCode: 200, // Will be updated
      paymentRequired: true,
      paymentProvided: !!paymentHeader,
      paymentValid: false,
      paymentId: undefined as string | undefined,
      clientIp: req.ip,
      clientWallet: undefined as string | undefined,
    };

    // 4. If no payment, return 402 with PAYMENT-REQUIRED header
    if (!paymentHeader) {
      console.log('💳 No payment provided, returning 402 Payment Required');

      const paymentRequired = this.x402Service.createPaymentRequiredResponse(requirements, {
        url: `${req.protocol}://${req.get('host')}${req.originalUrl}`,
        description: gateway.subdomain,
        mimeType: 'application/json',
      });

      // Encode requirements as base64 for PAYMENT-REQUIRED header (v2 protocol)
      const requirementsHeader = Buffer.from(JSON.stringify(paymentRequired)).toString('base64');

      this.analyticsService.logRequest({
        ...logData,
        statusCode: 402,
        durationMs: Date.now() - startTime,
      });

      res.status(402);
      res.set('PAYMENT-REQUIRED', requirementsHeader);
      res.json({
        error: 'Payment Required',
        message: 'This endpoint requires payment',
        details: {
          price: gateway.pricePerRequest,
          network: gateway.paymentNetwork || 'eip155:84532',
          recipient: gateway.evmAddress,
        },
      });
      return;
    }

    // 5. Verify payment with facilitator
    console.log('🔐 Payment provided, verifying with facilitator...');

    const verifyResult = await this.x402Service.verifyPayment(paymentHeader, requirements);

    if (!verifyResult.isValid) {
      console.log(`❌ Payment verification failed: ${verifyResult.invalidReason}`);

      this.analyticsService.logRequest({
        ...logData,
        statusCode: 402,
        paymentValid: false,
        durationMs: Date.now() - startTime,
      });

      res.status(402).json({
        error: 'Invalid Payment',
        reason: verifyResult.invalidReason,
      });
      return;
    }

    console.log('✅ Payment verified successfully');
    logData.paymentValid = true;

    // Store original json method
    const originalJson = res.json.bind(res);
    let settlementDone = false;

    // 6. Intercept response to add settlement
    const settleAndRespond = async (): Promise<void> => {
      if (settlementDone) return;
      settlementDone = true;

      console.log('💰 Settling payment on-chain...');

      try {
        const settleResult = await this.x402Service.settlePayment(
          verifyResult.paymentPayload,
          requirements,
        );

        // Add PAYMENT-RESPONSE header (v2 protocol)
        const settlementHeader = Buffer.from(JSON.stringify(settleResult)).toString('base64');
        res.set('PAYMENT-RESPONSE', settlementHeader);

        console.log(`✅ Payment settled: ${settleResult.transaction}`);
      } catch (error) {
        console.error(`❌ Settlement failed: ${error}`);
        // Continue with response even if settlement fails
      }
    };

    // Override json method to add settlement before responding
    res.json = function (this: Response, body: unknown): Response {
      void settleAndRespond().then(() => originalJson(body));
      return this;
    };

    // 7. Proxy Request to origin
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

          // res is http.ServerResponse, not Express.Response here strict speaking in types
          (res as any).writeHead(502, { 'Content-Type': 'text/plain' });
          (res as any).end('Bad Gateway');
        },
      },
    });

    proxy(req, res, next);
  }
}
