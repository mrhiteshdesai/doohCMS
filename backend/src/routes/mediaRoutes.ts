import express from 'express';
import * as mediaController from '../controllers/mediaController';
import { authenticate, checkPermission } from '../middleware/auth';
import upload from '../middleware/upload';

const router = express.Router();

router.use(authenticate);

// Get Library Content (Folders + Files)
router.get('/', checkPermission('media:read'), mediaController.getLibrary);

// Upload Files
router.post('/upload', checkPermission('media:write'), upload.array('files'), mediaController.uploadFiles);
router.post('/presigned-url', checkPermission('media:write'), mediaController.getPresignedUrl);
router.post('/register', checkPermission('media:write'), mediaController.registerFile);

// Files
router.put('/files/:id', checkPermission('media:write'), mediaController.updateFile);
router.delete('/files/:id', checkPermission('media:write'), mediaController.deleteFile);

// Folders
router.get('/folders', checkPermission('media:read'), mediaController.getAllFolders);
router.post('/folders', checkPermission('media:write'), mediaController.createFolder);
router.put('/folders/:id', checkPermission('media:write'), mediaController.updateFolder);
router.delete('/folders/:id', checkPermission('media:write'), mediaController.deleteFolder);

// Bulk Operations
router.post('/bulk/delete', checkPermission('media:write'), mediaController.bulkDelete);
router.post('/bulk/move', checkPermission('media:write'), mediaController.bulkMove);

export default router;
