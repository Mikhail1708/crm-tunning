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
router.use(authMiddleware as any);

// Публичные отчеты (для всех авторизованных)
router.get('/summary', getSummary as any);
router.get('/profit-chart', getProfitChart as any);
router.get('/profit-by-product', getProfitByProduct as any);
router.get('/expenses', getExpenses as any);
router.post('/expenses', createExpense as any);
router.get('/orders', getOrdersByPeriod as any);
router.get('/stats/:period', getSalesStats as any);

// Админские маршруты
router.delete('/sales/all', adminMiddleware as any, deleteAllSales as any);
router.delete('/clear-all', adminMiddleware as any, clearDatabase as any);
router.get('/dump', adminMiddleware as any, getDatabaseDump as any);
router.post('/restore', adminMiddleware as any, restoreDatabase as any);
router.delete('/database/clear', adminMiddleware as any, clearDatabase as any);

export default router;