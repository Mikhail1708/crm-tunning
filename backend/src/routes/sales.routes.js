// backend/src/routes/sales.routes.js
const express = require('express');
const router = express.Router();
const salesController = require('../controllers/sales.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

router.get('/', salesController.getAllSales);
router.get('/:id', salesController.getSaleById);
router.post('/', salesController.createSale);
router.delete('/:id', salesController.deleteSale);

module.exports = router;