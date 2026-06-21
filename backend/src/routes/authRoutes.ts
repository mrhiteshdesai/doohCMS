import { Router } from 'express';
import * as authController from '../controllers/authController';
import { authLimiter } from '../middleware/rateLimit';

const router = Router();

router.post('/register', authLimiter, authController.register);
router.post('/login', authLimiter, authController.login);

export default router;
