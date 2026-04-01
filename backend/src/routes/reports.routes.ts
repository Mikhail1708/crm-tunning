// backend/src/routes/reports.routes.ts
import { Router } from 'express';
import {
  getSummary,
  getProfitChart,
  getProfitByProduct,
  getExpenses,
  createExpense,
  getOrdersByPeriod,
  deleteAllSales,
  getSalesStats,
  getDatabaseDump,
  restoreDatabase,
  clearDatabase
} from '../controllers/reports.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Публичные отчеты (для всех авторизованных)
router.get('/summary', getSummary);
router.get('/profit-chart', getProfitChart);
router.get('/profit-by-product', getProfitByProduct);
router.get('/expenses', getExpenses);
router.post('/expenses', createExpense);
router.get('/orders', getOrdersByPeriod);
router.get('/stats/:period', getSalesStats);

// Админские маршруты
router.delete('/sales/all', adminMiddleware, deleteAllSales);
router.delete('/clear-all', adminMiddleware, clearDatabase);  // Добавляем этот маршрут
router.get('/dump', adminMiddleware, getDatabaseDump);
router.post('/restore', adminMiddleware, restoreDatabase);
router.delete('/database/clear', adminMiddleware, clearDatabase);  // Альтернативный маршрут

export default router;