// backend/src/routes/sales.routes.ts
import { Router } from 'express';
import {
  createSale,
  getAllSales,
  getSaleById,
  deleteSale
} from '../controllers/sales.controller';
import { authMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

router.get('/', getAllSales);
router.get('/:id', getSaleById);
router.post('/', createSale);
router.delete('/:id', deleteSale);

export default router;