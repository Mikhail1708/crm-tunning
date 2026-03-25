// backend/src/routes/reports.routes.js
const express = require('express');
const router = express.Router();
const reportsController = require('../controllers/reports.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Существующие маршруты
router.get('/summary', reportsController.getSummary);
router.get('/profit-by-product', reportsController.getProfitByProduct);
router.get('/profit-chart', reportsController.getProfitChart);
router.get('/expenses', reportsController.getExpenses);
router.post('/expenses', reportsController.createExpense);
router.get('/orders', reportsController.getOrdersByPeriod);
router.delete('/sales/all', adminMiddleware, reportsController.deleteAllSales);
router.get('/stats/:period', reportsController.getSalesStats);

// Маршруты для работы с дампом
router.get('/dump', adminMiddleware, reportsController.getDatabaseDump);
router.post('/restore', adminMiddleware, reportsController.restoreDatabase); // 👈 Убедитесь, что этот маршрут есть
router.delete('/clear-all', adminMiddleware, reportsController.clearDatabase);

module.exports = router;