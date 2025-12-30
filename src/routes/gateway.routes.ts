import { Router, Request } from 'express';
import { GatewayService } from '../services/gateway.service';
import { extractSubdomain, isValidSubdomain } from '../utils/subdomain.util';
import { authenticate, AuthRequest } from '../middleware/auth.middleware';

const router = Router();
const gatewayService = new GatewayService();

// Apply authentication to all gateway routes
router.use(authenticate);

// POST /api/gateways
router.post('/', async (req: Request, res) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;
    const { originUrl, pricePerRequest, acceptedNetworks, customDomain, subdomain } = req.body;

    if (!userId) {
      return res.status(401).json({ error: 'User not identified' });
    }

    // Basic validation
    if (!originUrl || !pricePerRequest || !acceptedNetworks || !subdomain) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (!isValidSubdomain(subdomain)) {
      return res.status(400).json({ error: 'Invalid subdomain format' });
    }

    const gateway = await gatewayService.createGateway({
      userId,
      subdomain,
      originUrl,
      pricePerRequest,
      acceptedNetworks,
      customDomain,
    });

    res.status(201).json(gateway);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// GET /api/gateways/:id
router.get('/:id', async (req, res) => {
  try {
    // TODO: Verify ownership?
    const gateway = await gatewayService.getGatewayById(req.params.id);
    if (!gateway) return res.status(404).json({ error: 'Not found' });
    res.json(gateway);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gateways (List by user)
router.get('/', async (req: Request, res) => {
  try {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.userId;

    if (!userId) {
      return res.status(401).json({ error: 'User not identified' });
    }

    const gateways = await gatewayService.getGatewaysByUser(userId);
    res.json(gateways);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/gateways/:id
router.patch('/:id', async (req, res) => {
  try {
    // TODO: Verify ownership
    const gateway = await gatewayService.updateGateway(req.params.id, req.body);
    res.json(gateway);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gateways/:id
router.delete('/:id', async (req, res) => {
  try {
    // TODO: Verify ownership
    await gatewayService.deleteGateway(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
