import { Router } from 'express';
import { authenticate, checkPermission } from '../middleware/auth';
import * as userController from '../controllers/userController';

const router = Router();

router.use(authenticate);

router.get('/', checkPermission('team:read'), userController.getUsers);
router.post('/', checkPermission('team:write'), userController.createUser);
router.get('/profile', userController.getProfile);
router.put('/profile', userController.updateProfile);
router.get('/roles', checkPermission('team:read'), userController.getRoles); // Helper to get roles for dropdown
router.get('/:id', checkPermission('team:read'), userController.getUser);
router.put('/:id', checkPermission('team:write'), userController.updateUser);
router.delete('/:id', checkPermission('team:delete'), userController.deleteUser);

export default router;
