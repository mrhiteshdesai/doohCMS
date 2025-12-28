import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth';
import * as tenantController from '../controllers/tenantController';

const router = Router();

router.get('/branding', tenantController.getPublicBranding);

router.use(authenticate);

router.get('/settings', checkPermission('settings:read'), tenantController.getSettings);
router.put('/settings', checkPermission('settings:write'), tenantController.updateSettings);

export default router;
