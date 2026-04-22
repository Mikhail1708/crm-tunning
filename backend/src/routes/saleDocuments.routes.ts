// backend/src/routes/saleDocuments.routes.ts
import { Router } from 'express';
import {
  getSaleDocuments,
  getSaleDocumentById,
  createSaleDocument,
  updateSaleDocument,
  updatePaymentStatus,
  updateOrderStatus,
  getOrderStatus,
  deleteSaleDocument,
  getDocumentsByClient,
  getClientStatistics
} from '../controllers/saleDocuments.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware as any);

router.get('/', getSaleDocuments as any);
router.get('/stats/clients', getClientStatistics as any);
router.get('/client/:clientId', getDocumentsByClient as any);
router.get('/:id', getSaleDocumentById as any);
router.get('/:id/status', getOrderStatus as any);
router.post('/', managerAccess as any, createSaleDocument as any);
router.put('/:id', managerAccess as any, updateSaleDocument as any);
router.patch('/:id/payment-status', managerAccess as any, updatePaymentStatus as any);
router.put('/:id/payment', managerAccess as any, updatePaymentStatus as any);
router.patch('/:id/status', updateOrderStatus as any);
router.delete('/:id', managerAccess as any, deleteSaleDocument as any);

export default router;