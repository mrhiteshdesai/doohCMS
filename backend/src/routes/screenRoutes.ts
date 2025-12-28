import express from 'express';
import * as screenController from '../controllers/screenController';
import { authenticate, authorize, checkPermission } from '../middleware/auth';

const router = express.Router();

// Player Routes (Delegated to /api/player)
// router.post('/player/register', screenController.registerPlayer);
// router.get('/player/status/:code', screenController.checkPairingStatus);
// router.post('/player/heartbeat', screenController.sendHeartbeat); // Consider protecting this
// router.get('/player/content', authenticate, screenController.getScreenContent);

// CMS routes (Protected)
router.get('/', authenticate, checkPermission('screen:read'), screenController.getScreens);
router.get('/:id', authenticate, checkPermission('screen:read'), screenController.getScreen);
router.get('/:id/logs/export', authenticate, checkPermission('screen:read'), screenController.exportLogs);

router.post('/', authenticate, checkPermission('screen:write'), screenController.pairScreen);
router.put('/:id', authenticate, checkPermission('screen:write'), screenController.updateScreen);
router.delete('/:id', authenticate, checkPermission('screen:delete'), screenController.deleteScreen);

// Actions
router.post('/:id/publish', authenticate, checkPermission('screen:publish'), screenController.publishPlaylist);
router.post('/:id/snapshot', authenticate, checkPermission('screen:write'), screenController.requestSnapshot);
router.post('/:id/command', authenticate, checkPermission('screen:write'), screenController.sendCommand);
router.post('/:id/reset', authenticate, checkPermission('screen:write'), screenController.resetScreenContent);
router.post('/:id/commands/clear', authenticate, checkPermission('screen:write'), screenController.clearCommandHistory);

export default router;
