import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth';
import * as scheduleController from '../controllers/scheduleController';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('schedule:read'), scheduleController.getSchedules);
router.post('/', checkPermission('schedule:write'), scheduleController.createSchedule);
router.put('/:id', checkPermission('schedule:write'), scheduleController.updateSchedule);
router.delete('/:id', checkPermission('schedule:write'), scheduleController.deleteSchedule);

export default router;
