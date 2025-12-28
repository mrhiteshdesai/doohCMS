import express from 'express';
import * as reportController from '../controllers/reportController';
import { authenticate, checkPermission } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

router.get('/proof-of-play', checkPermission('report:read'), reportController.getProofOfPlay);
router.get('/uptime', checkPermission('report:read'), reportController.getUptimeReport);

export default router;
