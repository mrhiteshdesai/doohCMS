import { Router } from 'express';
import * as playerController from '../controllers/playerController';
import * as screenController from '../controllers/screenController';
import { authenticate } from '../middleware/auth';
import { heartbeatLimiter, playerRegisterLimiter, playerStatusLimiter } from '../middleware/rateLimit';
import upload, { supportBundleUpload } from '../middleware/upload';

const router = Router();

// Public (Device Init)
router.get('/branding', playerController.getSystemBranding);
router.post('/register', playerRegisterLimiter, playerController.generatePairingCode);
router.get('/status/:code', playerStatusLimiter, playerController.checkPairingStatus);

// Authenticated (Device Operations)
router.post('/heartbeat', authenticate, heartbeatLimiter, playerController.heartbeat);
router.get('/content', authenticate, screenController.getScreenContent);
router.get('/manifest', authenticate, playerController.getNativeManifest);
router.post('/pop', authenticate, playerController.submitProofOfPlay);
router.post('/ad-impression', authenticate, playerController.submitAdImpression);
router.post('/snapshot', authenticate, upload.single('snapshot'), playerController.uploadSnapshot);
router.post('/support-bundle', authenticate, supportBundleUpload.single('bundle'), playerController.uploadSupportBundle);

export default router;
