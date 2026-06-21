import express from 'express';
import * as systemSettingsController from '../controllers/systemSettingsController';
import { authenticate, checkPermission } from '../middleware/auth';
import { commandLimiter } from '../middleware/rateLimit';

const router = express.Router();

router.use(authenticate);

router.get('/', checkPermission('settings:read'), systemSettingsController.getSystemSettings);
router.put('/', commandLimiter, checkPermission('settings:write'), systemSettingsController.updateSystemSettings);

// Retention Policies
router.get('/retention', checkPermission('settings:read'), systemSettingsController.getRetentionPolicies);
router.post('/retention', commandLimiter, checkPermission('settings:write'), systemSettingsController.updateRetentionPolicy);
router.get('/observability', checkPermission('settings:read'), systemSettingsController.getObservabilityMetrics);

export default router;
