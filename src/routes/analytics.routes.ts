import { Router } from 'express';
import { AnalyticsService } from '../services/analytics.service';
import { AnalyticsController } from '../controllers/analytics.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const analyticsService = new AnalyticsService();
const analyticsController = new AnalyticsController(analyticsService);

// Apply authentication
router.use(authenticate);

// Routes
// Legacy analytics routes removed - Payment model no longer exists
// router.get('/overview', analyticsController.getOverview);
// router.get('/top-payers', analyticsController.getTopPayers);

export default router;
