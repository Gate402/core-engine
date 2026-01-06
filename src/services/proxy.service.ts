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
    // console.log('Received request', req);
    // Get hostname and strip port (e.g., "test-api.localhost:3030" -> "test-api.localhost")
    const rawHostname = req.get('host') || req.hostname;
    const hostname = rawHostname.split(':')[0];

    // 1. Identify Gateway
    const gateway = await this.gatewayService.resolveGateway(hostname);

    if (!gateway) {
      return res.status(404).send('Gateway not found');
    }

    // 2. Validate gateway configuration
    if (!gateway.originUrl || !gateway.evmAddress) {
      console.error(`Gateway ${gateway.id} has invalid configuration`);
      return res.status(500).json({ error: 'Gateway misconfiguration' });
    }

    // 3. Prevent SSRF attacks - validate origin URL
    try {
      const originUrl = new URL(gateway.originUrl);
      // Block private IPs and localhost in production
      if (process.env.NODE_ENV === 'production') {
        const blockedHosts = ['localhost', '127.0.0.1', '0.0.0.0', '::1'];
        const privateRanges = /^(10|172\.(1[6-9]|2[0-9]|3[0-1])|192\.168)\./;

        if (blockedHosts.includes(originUrl.hostname) || privateRanges.test(originUrl.hostname)) {
          console.error(`Blocked SSRF attempt to ${gateway.originUrl}`);
          return res.status(403).json({ error: 'Invalid origin URL' });
        }
      }
    } catch (error) {
      console.error(`Invalid origin URL for gateway ${gateway.id}: ${gateway.originUrl}`);
      return res.status(500).json({ error: 'Invalid gateway origin URL' });
    }

    req.gateway = gateway;

    // 4. Build payment requirements for this gateway
    let requirements: PaymentRequirements;
    try {
      requirements = await this.x402Service.buildPaymentRequirements(gateway);
    } catch (error) {
      console.error('Failed to build payment requirements:', error);
      return res.status(500).json({ error: 'Server configuration error' });
    }

    // 5. Check for payment headers (v2: PAYMENT-SIGNATURE, v1: X-PAYMENT)
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

    // 6. If no payment, return 402 with PAYMENT-REQUIRED header
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
          price: gateway.defaultPricePerRequest,
          network: gateway.paymentNetwork || 'eip155:84532',
          recipient: gateway.evmAddress,
        },
      });
      return;
    }

    // 7. Verify payment with facilitator
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

    // 8. Settle payment BEFORE proxying to avoid header conflicts
    console.log('💰 Settling payment on-chain...');

    try {
      const settleResult = await this.x402Service.settlePayment(
        verifyResult.paymentPayload,
        requirements,
      );
      console.log({ settleResult });

      if (!settleResult.success) {
        console.log('❌ Settlement failed: No result');

        this.analyticsService.logRequest({
          ...logData,
          statusCode: 502,
          durationMs: Date.now() - startTime,
        });

        return res.status(502).json({
          error: 'Payment settlement failed',
          details: settleResult,
        });
      }

      // Add PAYMENT-RESPONSE header (v2 protocol)
      const settlementHeader = Buffer.from(JSON.stringify(settleResult)).toString('base64');
      res.set('PAYMENT-RESPONSE', settlementHeader);

      console.log(`✅ Payment settled: ${settleResult.transaction}`);
    } catch (error) {
      console.error(`❌ Settlement failed: ${error}`);

      this.analyticsService.logRequest({
        ...logData,
        statusCode: 502,
        durationMs: Date.now() - startTime,
      });

      return res.status(502).json({
        error: 'Payment settlement failed',
        details: error instanceof Error ? error.message : String(error),
      });
    }

    console.log('Starting proxying');
    console.log('target: ', gateway);
    // 9. Proxy Request to origin
    const proxy = createProxyMiddleware({
      target: gateway.originUrl,
      changeOrigin: true,

      // Timeout configuration (30 seconds default)
      timeout: 30000,
      proxyTimeout: 30000,

      // WebSocket support
      ws: true,

      // Follow redirects
      followRedirects: true,

      pathRewrite: (path, req) => {
        return path; // Keep path as is
      },
      on: {
        proxyReq: (proxyReq, req: any, res) => {
          console.log('inside proxy req');
          // 1. Preserve original request method and path
          proxyReq.path = req.originalUrl || req.url;

          // 2. Standard forwarding headers (RFC 7239)
          const clientIp = req.ip || req.socket.remoteAddress || 'unknown';
          const existingForwardedFor = req.get('x-forwarded-for');
          proxyReq.setHeader(
            'X-Forwarded-For',
            existingForwardedFor ? `${existingForwardedFor}, ${clientIp}` : clientIp,
          );

          proxyReq.setHeader('X-Forwarded-Proto', req.protocol || 'http');
          proxyReq.setHeader('X-Forwarded-Host', req.get('host') || hostname);

          // 3. Real IP headers (for additional IP detection)
          proxyReq.setHeader('X-Real-IP', clientIp);

          // 4. Original request metadata
          proxyReq.setHeader('X-Original-URI', req.originalUrl || req.url);
          proxyReq.setHeader('X-Original-Method', req.method);

          // 5. Gate402-specific headers
          proxyReq.setHeader('X-Gate402-Secret', gateway.secretToken);
          proxyReq.setHeader('X-Gate402-Gateway-ID', gateway.id);
          proxyReq.setHeader('X-Gate402-Subdomain', gateway.subdomain);

          // 6. Payment verification metadata
          if (logData.paymentValid) {
            proxyReq.setHeader('X-Gate402-Payment-Verified', 'true');
            proxyReq.setHeader(
              'X-Gate402-Payment-Network',
              gateway.paymentNetwork || 'eip155:84532',
            );
          }

          // 7. Remove hop-by-hop headers (RFC 2616)
          const hopByHopHeaders = [
            'connection',
            'keep-alive',
            'proxy-authenticate',
            'proxy-authorization',
            'te',
            'trailers',
            'transfer-encoding',
            'upgrade',
          ];
          hopByHopHeaders.forEach((header) => proxyReq.removeHeader(header));

          // 8. Set proper content-length if body exists
          if (req.body && Object.keys(req.body).length > 0) {
            const bodyData = JSON.stringify(req.body);
            proxyReq.setHeader('Content-Length', Buffer.byteLength(bodyData));
            proxyReq.write(bodyData);
          }
        },
        proxyRes: (proxyRes, req: any, res) => {
          console.log('inside proxyRes');
          // 1. Add proxy metadata headers
          res.setHeader('X-Proxied-By', 'Gate402');
          res.setHeader('X-Gateway-ID', gateway.id);

          // 2. Remove sensitive origin headers that shouldn't be exposed
          delete proxyRes.headers['x-powered-by'];
          delete proxyRes.headers['server'];

          // 3. Handle CORS if origin server doesn't
          if (!proxyRes.headers['access-control-allow-origin']) {
            const origin = req.get('origin');
            if (origin) {
              res.setHeader('Access-Control-Allow-Origin', origin);
              res.setHeader('Access-Control-Allow-Credentials', 'true');
            }
          }

          // 4. Add cache headers for payment-verified requests
          if (logData.paymentValid) {
            // Don't cache payment-protected responses by default
            if (!proxyRes.headers['cache-control']) {
              res.setHeader('Cache-Control', 'private, no-cache, no-store, must-revalidate');
            }
          }

          // 5. Log success after response
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
