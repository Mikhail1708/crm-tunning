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

// Маршруты для создания и редактирования (доступны admin и manager)
// Для поддержки менеджеров - используем кастомную проверку
const managerAccess = (req, res, next) => {
  if (req.user.role === 'admin' || req.user.role === 'manager') {
    return next();
  }
  return res.status(403).json({ error: 'Доступ запрещен. Требуются права администратора или менеджера.' });
};

router.post('/', managerAccess, productsController.createProduct);
router.put('/:id', managerAccess, productsController.updateProduct);
router.delete('/:id', managerAccess, productsController.deleteProduct);

module.exports = router;