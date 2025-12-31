import { Router } from 'express';
import { GatewayService } from '../services/gateway.service';
import { GatewayController } from '../controllers/gateway.controller';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const gatewayService = new GatewayService();
const gatewayController = new GatewayController(gatewayService);

// Apply authentication to all gateway routes
router.use(authenticate);

// Routes
router.post('/quick-create', gatewayController.quickCreate); // Must be before '/'
router.post('/', gatewayController.createGateway);
router.get('/:id', gatewayController.getGatewayById);
router.get('/', gatewayController.getGatewaysByUser);
router.patch('/:id', gatewayController.updateGateway);
router.delete('/:id', gatewayController.deleteGateway);

export default router;
