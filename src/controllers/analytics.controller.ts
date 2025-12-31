import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  public getOverview = async (req: Request, res: Response) => {
    try {
      const gatewayId = req.query.gatewayId as string;
      if (!gatewayId) return res.status(400).json({ error: 'gatewayId required' });

      // TODO: Verify ownership
      const stats = await this.analyticsService.getGatewayOverview(gatewayId);
      res.json(stats);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };

  public getTopPayers = async (req: Request, res: Response) => {
    try {
      const gatewayId = req.query.gatewayId as string;
      if (!gatewayId) return res.status(400).json({ error: 'gatewayId required' });

      const topPayers = await this.analyticsService.getTopPayers(gatewayId);
      res.json(topPayers);
    } catch (err: any) {
      res.status(500).json({ error: err.message });
    }
  };
}
