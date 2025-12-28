import { Router } from 'express';
import * as playerController from '../controllers/playerController';
import * as screenController from '../controllers/screenController';
import { authenticate } from '../middleware/auth';
import upload from '../middleware/upload';

const router = Router();

// Public (Device Init)
router.get('/branding', playerController.getSystemBranding);
router.post('/register', playerController.generatePairingCode);
router.get('/status/:code', playerController.checkPairingStatus);

// Authenticated (Device Operations)
router.post('/heartbeat', authenticate, playerController.heartbeat);
router.get('/content', authenticate, screenController.getScreenContent);
router.post('/pop', authenticate, playerController.submitProofOfPlay);
router.post('/snapshot', authenticate, upload.single('snapshot'), playerController.uploadSnapshot);

export default router;
