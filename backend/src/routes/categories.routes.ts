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
router.use(authMiddleware);

// Маршруты для категорий
router.get('/', getCategories);
router.get('/:id', getCategoryById);
router.post('/', managerAccess, createCategory);
router.put('/:id', managerAccess, updateCategory);
router.delete('/:id', managerAccess, deleteCategory);

// Маршруты для полей категорий
router.get('/:categoryId/fields', getCategoryFields);
router.post('/:categoryId/fields', managerAccess, createCategoryField);
router.put('/fields/:id', managerAccess, updateCategoryField);
router.delete('/fields/:id', managerAccess, deleteCategoryField);

export default router;