import { Router } from 'express';
import multer from 'multer';
import path from 'path';
import fs from 'fs';
import * as appReleaseController from '../controllers/appReleaseController';
import { authenticate, checkPermission } from '../middleware/auth';
import { commandLimiter } from '../middleware/rateLimit';

const router = Router();

const tmpDir = path.join(__dirname, '../../uploads/_tmp');
if (!fs.existsSync(tmpDir)) {
  fs.mkdirSync(tmpDir, { recursive: true });
}

const apkUpload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, tmpDir),
    filename: (_req, file, cb) => {
      const unique = `${Date.now()}-${Math.round(Math.random() * 1e9)}`;
      cb(null, `${unique}${path.extname(file.originalname) || '.apk'}`);
    },
  }),
  fileFilter: (_req, file, cb) => {
    const nameOk = file.originalname.toLowerCase().endsWith('.apk');
    const mimeOk =
      file.mimetype === 'application/vnd.android.package-archive' ||
      file.mimetype === 'application/octet-stream' ||
      file.mimetype === 'application/zip';
    if (nameOk || mimeOk) cb(null, true);
    else cb(new Error(`Only APK files are allowed. Received: ${file.mimetype}`));
  },
  limits: { fileSize: 512 * 1024 * 1024 },
});

router.use(authenticate);

router.get('/', checkPermission('screen:read'), appReleaseController.listReleases);
router.get('/rollout/status', checkPermission('screen:read'), appReleaseController.getRolloutStatus);
router.get('/:id', checkPermission('screen:read'), appReleaseController.getRelease);
router.post(
  '/upload',
  commandLimiter,
  checkPermission('screen:write'),
  apkUpload.single('apk'),
  appReleaseController.createReleaseUpload
);
router.post('/from-url', commandLimiter, checkPermission('screen:write'), appReleaseController.createReleaseUrl);
router.post('/:id/rollout', commandLimiter, checkPermission('screen:write'), appReleaseController.rolloutRelease);
router.delete('/:id', commandLimiter, checkPermission('screen:write'), appReleaseController.deleteRelease);

export default router;
