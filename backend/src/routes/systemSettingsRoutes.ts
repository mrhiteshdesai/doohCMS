import express from 'express';
import * as systemSettingsController from '../controllers/systemSettingsController';
import { authenticate, checkPermission } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

router.get('/', checkPermission('settings:read'), systemSettingsController.getSystemSettings);
router.put('/', checkPermission('settings:write'), systemSettingsController.updateSystemSettings);

export default router;
