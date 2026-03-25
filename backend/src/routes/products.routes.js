// backend/src/routes/products.routes.js
const express = require('express');
const router = express.Router();
const productsController = require('../controllers/products.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Публичные маршруты (для всех авторизованных)
router.get('/', productsController.getProducts);
router.get('/low-stock', productsController.getLowStockProducts);
router.get('/:id', productsController.getProductById);

// Админские маршруты
router.post('/', adminMiddleware, productsController.createProduct);
router.put('/:id', adminMiddleware, productsController.updateProduct);
router.delete('/:id', adminMiddleware, productsController.deleteProduct);

module.exports = router;