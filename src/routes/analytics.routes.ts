import { Router } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { GatewayService } from '../services/gateway.service';

const router = Router();
const analyticsService = new AnalyticsService();
const gatewayService = new GatewayService();

// GET /api/analytics/overview?gatewayId=xyz
router.get('/overview', async (req, res) => {
  try {
    const gatewayId = req.query.gatewayId as string;
    if (!gatewayId) return res.status(400).json({ error: 'gatewayId required' });

    // Verify ownership if we had auth (skipped for MVP)

    const stats = await analyticsService.getGatewayOverview(gatewayId);
    res.json(stats);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/analytics/top-payers?gatewayId=xyz
router.get('/top-payers', async (req, res) => {
  try {
    const gatewayId = req.query.gatewayId as string;
    if (!gatewayId) return res.status(400).json({ error: 'gatewayId required' });

    const topPayers = await analyticsService.getTopPayers(gatewayId);
    res.json(topPayers);
  } catch (err: any) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
