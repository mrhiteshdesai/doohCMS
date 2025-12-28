import { Router } from 'express';
import * as playlistController from '../controllers/playlistController';
import { authenticate, checkPermission } from '../middleware/auth';

const router = Router();

router.use(authenticate);

router.post('/', checkPermission('playlist:write'), playlistController.createPlaylist);
router.get('/', checkPermission('playlist:read'), playlistController.getPlaylists);
router.get('/:id', checkPermission('playlist:read'), playlistController.getPlaylistById);
router.put('/:id', checkPermission('playlist:write'), playlistController.updatePlaylist);
router.delete('/:id', checkPermission('playlist:delete'), playlistController.deletePlaylist);
router.post('/bulk-delete', checkPermission('playlist:delete'), playlistController.bulkDeletePlaylists);

export default router;
