import { Router } from 'express';
import * as adminController from '../controllers/adminController';
import { authMiddleware } from '../middleware/auth';

const router = Router();

// In a real app, only login would be public. 
// For now, we apply the middleware to all admin routes.
router.use(authMiddleware);

router.get('/devices', adminController.getDevices);
router.post('/devices', adminController.createDevice);
router.patch('/devices/:id', adminController.updateDevice);
router.delete('/devices/:id', adminController.deleteDevice);

router.get('/playlists', adminController.getPlaylists);
router.post('/playlists', adminController.createPlaylist);
router.patch('/playlists/:id', adminController.updatePlaylist);
router.delete('/playlists/:id', adminController.deletePlaylist);

export default router;
