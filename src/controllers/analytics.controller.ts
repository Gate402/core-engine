import { Request, Response } from 'express';
import { AnalyticsService } from '../services/analytics.service';

export class AnalyticsController {
  constructor(private analyticsService: AnalyticsService) {}

  // Legacy analytics methods removed - Payment model no longer exists
  // Analytics will be tracked via RequestLog or external blockchain indexer
}
