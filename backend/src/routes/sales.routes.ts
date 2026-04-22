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
router.use(authMiddleware as any);

router.get('/', getAllSales as any);
router.get('/:id', getSaleById as any);
router.post('/', createSale as any);
router.delete('/:id', deleteSale as any);

export default router;