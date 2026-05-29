// backend/src/routes/categories.routes.ts
import { Router } from 'express';
import {
  getCategories,
  getCategoryById,
  createCategory,
  updateCategory,
  deleteCategory,
  getCategoryFields,
  createCategoryField,
  updateCategoryField,
  deleteCategoryField
} from '../controllers/categories.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware as any);

// Маршруты для категорий
router.get('/', getCategories as any);
router.get('/:id', getCategoryById as any);
router.post('/', managerAccess as any, createCategory as any);
router.put('/:id', managerAccess as any, updateCategory as any);
router.delete('/:id', managerAccess as any, deleteCategory as any);

// Маршруты для полей категорий
router.get('/:categoryId/fields', getCategoryFields as any);
router.post('/:categoryId/fields', managerAccess as any, createCategoryField as any);
router.put('/fields/:id', managerAccess as any, updateCategoryField as any);
router.delete('/fields/:id', managerAccess as any, deleteCategoryField as any);

export default router;