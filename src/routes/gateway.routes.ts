import { Router } from 'express';
import { GatewayService } from '../services/gateway.service';
import { extractSubdomain, isValidSubdomain } from '../utils/subdomain.util';

const router = Router();
const gatewayService = new GatewayService();

// Middleware to mock a "logged in user" for now, or assume UserId is passed?
// Instructions said "User" model exists and "auth.middleware.ts" was in project structure.
// I will assume for now we just pass userId in body or headers for MVP testing.
// In real app, we'd extract from JWT.

// POST /api/gateways
router.post('/', async (req, res) => {
  try {
    const { userId, originUrl, pricePerRequest, acceptedNetworks, customDomain, subdomain } =
      req.body;

    // Basic validation
    if (!userId || !originUrl || !pricePerRequest || !acceptedNetworks || !subdomain) {
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
    const gateway = await gatewayService.getGatewayById(req.params.id);
    if (!gateway) return res.status(404).json({ error: 'Not found' });
    res.json(gateway);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/gateways (List by user)
router.get('/', async (req, res) => {
  try {
    const userId = req.query.userId as string;
    if (!userId) return res.status(400).json({ error: 'UserId required' });

    const gateways = await gatewayService.getGatewaysByUser(userId);
    res.json(gateways);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// PATCH /api/gateways/:id
router.patch('/:id', async (req, res) => {
  try {
    const gateway = await gatewayService.updateGateway(req.params.id, req.body);
    res.json(gateway);
  } catch (err: any) {
    res.status(400).json({ error: err.message });
  }
});

// DELETE /api/gateways/:id
router.delete('/:id', async (req, res) => {
  try {
    await gatewayService.deleteGateway(req.params.id);
    res.status(204).send();
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
