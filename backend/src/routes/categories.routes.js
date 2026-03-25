// backend/src/routes/categories.routes.js
const express = require('express');
const router = express.Router();
const categoriesController = require('../controllers/categories.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Публичные маршруты (для всех авторизованных)
router.get('/', categoriesController.getCategories);
router.get('/:id', categoriesController.getCategoryById);
router.get('/:categoryId/fields', categoriesController.getCategoryFields);

// Админские маршруты
router.post('/', adminMiddleware, categoriesController.createCategory);
router.put('/:id', adminMiddleware, categoriesController.updateCategory);
router.delete('/:id', adminMiddleware, categoriesController.deleteCategory);
router.post('/:categoryId/fields', adminMiddleware, categoriesController.createCategoryField);
router.put('/fields/:id', adminMiddleware, categoriesController.updateCategoryField);
router.delete('/fields/:id', adminMiddleware, categoriesController.deleteCategoryField);

module.exports = router;