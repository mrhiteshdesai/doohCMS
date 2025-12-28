import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth';
import * as layoutController from '../controllers/layoutController';

const router = Router();

router.use(authenticate);

router.post('/', checkPermission('layout:write'), layoutController.createLayout);
router.get('/', checkPermission('layout:read'), layoutController.getLayouts);
router.post('/bulk-delete', checkPermission('layout:write'), layoutController.bulkDeleteLayouts);
router.get('/:id', checkPermission('layout:read'), layoutController.getLayoutById);
router.put('/:id', checkPermission('layout:write'), layoutController.updateLayout);
router.delete('/:id', checkPermission('layout:write'), layoutController.deleteLayout);

export default router;
