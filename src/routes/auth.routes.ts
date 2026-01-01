import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import { AuthenticationService } from '../services/authentication.service';
import { authenticate } from '../middleware/auth.middleware';

const router = Router();
const authService = new AuthenticationService();
const authController = new AuthController(authService);

router.post('/google', authController.googleLogin);
router.post('/otp/request', authController.requestOtp);
router.post('/otp/verify', authController.verifyOtp);
router.post('/refresh', authController.refreshToken);
router.post('/siwe/nonce', authController.getSiweNonce);
router.post('/siwe/verify', authController.verifySiwe);
router.post('/siwe/complete-profile', authenticate, authController.updateProfile);

export default router;
