import { Request, Response } from 'express';
import { GatewayService } from '../services/gateway.service';
import { AuthRequest } from '../middleware/auth.middleware';
import { isValidSubdomain, generateSubdomain } from '../utils/subdomain.util';

export class GatewayController {
  constructor(private gatewayService: GatewayService) {}

  /**
   * Quick-create gateway with auto-generated subdomain
   * POST /api/gateways/quick-create
   */
  public quickCreate = async (req: Request, res: Response): Promise<any> => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;
      const { originUrl, pricePerRequest, evmAddress } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User not identified' });
      }

      // Validate required fields
      if (!originUrl || !pricePerRequest || !evmAddress) {
        return res.status(400).json({
          error: 'Missing required fields (originUrl, pricePerRequest, evmAddress)',
        });
      }

      // Auto-generate subdomain from origin URL
      const subdomain = generateSubdomain(originUrl);

      // Get network configuration from environment
      const mainnetEnabled = process.env.MAINNET_ENABLED === 'true';
      const defaultNetwork = process.env.DEFAULT_NETWORK || 'eip155:84532';

      // Force testnet if mainnet is not enabled
      const paymentNetwork = mainnetEnabled ? defaultNetwork : 'eip155:84532';

      const gateway = await this.gatewayService.createGateway({
        userId,
        subdomain,
        originUrl,
        defaultPricePerRequest: pricePerRequest,
        paymentScheme: 'exact',
        paymentNetwork,
        evmAddress,
      });

      // Return gateway with helpful URLs
      res.status(201).json({
        ...gateway,
        gatewayUrl: `https://${gateway.subdomain}.gate402.io`,
        testUrl: `http://${gateway.subdomain}.localhost:3030`,
        network: paymentNetwork,
        isTestnet: paymentNetwork === 'eip155:84532',
      });
    } catch (err: any) {
      // If subdomain collision, retry with new random suffix
      if (err.message.includes('Subdomain already taken')) {
        return this.quickCreate(req, res);
      }
      res.status(400).json({ error: err.message });
    }
  };

  public createGateway = async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;
      const {
        originUrl,
        pricePerRequest,
        customDomain,
        subdomain,
        paymentScheme,
        paymentNetwork,
        evmAddress,
      } = req.body;

      if (!userId) {
        return res.status(401).json({ error: 'User not identified' });
      }

      // Basic validation
      if (!originUrl || !pricePerRequest || !subdomain || !evmAddress) {
        return res.status(400).json({
          error: 'Missing required fields (originUrl, pricePerRequest, subdomain, evmAddress)',
        });
      }

      if (!isValidSubdomain(subdomain)) {
        return res.status(400).json({ error: 'Invalid subdomain format' });
      }

      const gateway = await this.gatewayService.createGateway({
        userId,
        subdomain,
        originUrl,
        defaultPricePerRequest: pricePerRequest,
        customDomain,
        paymentScheme,
        paymentNetwork,
        evmAddress,
      });

      res.status(201).json(gateway);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  public getGatewayById = async (req: Request, res: Response) => {
    try {
      const gateway = await this.gatewayService.getGatewayById(req.params.id);
      if (!gateway) return res.status(404).json({ error: 'Not found' });
      res.json(gateway);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  public getGatewaysByUser = async (req: Request, res: Response) => {
    try {
      const authReq = req as AuthRequest;
      const userId = authReq.user?.userId;

      if (!userId) {
        return res.status(401).json({ error: 'User not identified' });
      }

      const gateways = await this.gatewayService.getGatewaysByUser(userId);
      res.json(gateways);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  public updateGateway = async (req: Request, res: Response) => {
    try {
      // TODO: Verify ownership
      const gateway = await this.gatewayService.updateGateway(req.params.id, req.body);
      res.json(gateway);
    } catch (err: any) {
      res.status(400).json({ error: err.message });
    }
  };

  public deleteGateway = async (req: Request, res: Response) => {
    try {
      // TODO: Verify ownership
      await this.gatewayService.deleteGateway(req.params.id);
      res.status(204).send();
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}
