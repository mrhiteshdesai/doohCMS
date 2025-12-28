import { Router } from 'express';
import { authenticate } from '../middleware/auth';
import * as dashboardController from '../controllers/dashboardController';

const router = Router();

router.use(authenticate);

router.get('/stats', dashboardController.getStats);

export default router;
