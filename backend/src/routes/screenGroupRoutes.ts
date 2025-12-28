import express from 'express';
import * as screenGroupController from '../controllers/screenGroupController';
import { authenticate } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

router.post('/', screenGroupController.createGroup);
router.get('/', screenGroupController.getGroups);
router.get('/:id', screenGroupController.getGroupById);
router.put('/:id', screenGroupController.updateGroup);
router.delete('/:id', screenGroupController.deleteGroup);
router.post('/:id/screens', screenGroupController.assignScreens);
router.post('/:id/publish', screenGroupController.publishPlaylist);

export default router;
