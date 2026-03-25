import { Router } from 'express';
import * as deviceController from '../controllers/deviceController';

const router = Router();

router.get('/device-status/:mac', deviceController.getDeviceStatus);

export default router;
