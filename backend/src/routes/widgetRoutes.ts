import express from 'express';
import * as widgetController from '../controllers/widgetController';
import { authenticate, checkPermission } from '../middleware/auth';

const router = express.Router();

router.use(authenticate);

router.get('/', checkPermission('widget:read'), widgetController.getWidgets);
router.post('/', checkPermission('widget:write'), widgetController.createWidget);
router.get('/:id', checkPermission('widget:read'), widgetController.getWidget);
router.put('/:id', checkPermission('widget:write'), widgetController.updateWidget);
router.delete('/:id', checkPermission('widget:write'), widgetController.deleteWidget);

export default router;