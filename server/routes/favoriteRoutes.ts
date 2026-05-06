import { Router } from 'express';
import * as favoriteController from '../controllers/favoriteController';

const router = Router();

router.post('/toggle', favoriteController.toggleFavorite);
router.get('/', favoriteController.getFavorites);

export default router;
