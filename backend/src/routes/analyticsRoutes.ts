import express from 'express';
import { authenticate } from '../middleware/auth';
import * as analyticsController from '../controllers/analyticsController';

const router = express.Router();

router.use(authenticate);

router.get('/pop/stats', analyticsController.getProofOfPlayStats);

export default router;
