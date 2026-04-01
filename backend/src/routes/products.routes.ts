// backend/src/routes/products.routes.ts
import { Router } from 'express';
import {
  getProducts,
  getProductById,
  createProduct,
  updateProduct,
  deleteProduct,
  getLowStockProducts
} from '../controllers/products.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Публичные маршруты (только чтение)
router.get('/', getProducts);
router.get('/low-stock', getLowStockProducts);
router.get('/:id', getProductById);

// Маршруты для менеджеров и админов (изменение данных)
router.post('/', managerAccess, createProduct);
router.put('/:id', managerAccess, updateProduct);
router.delete('/:id', managerAccess, deleteProduct);

export default router;