import { Router } from 'express';
import * as AuthController from '../controllers/auth.controller';

const router = Router();

router.post('/google', AuthController.googleLogin);
router.post('/otp/request', AuthController.requestOtp);
router.post('/otp/verify', AuthController.verifyOtp);
router.post('/refresh', AuthController.refreshToken);

export default router;
