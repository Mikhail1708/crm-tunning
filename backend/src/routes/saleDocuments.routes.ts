// backend/src/routes/saleDocuments.routes.ts
import { Router } from 'express';
import {
  getSaleDocuments,
  getSaleDocumentById,
  createSaleDocument,
  updateSaleDocument,
  updatePaymentStatus,
  updateOrderStatus,
  getOrderStatus,  // 🆕 добавить импорт
  deleteSaleDocument,
  getDocumentsByClient,
  getClientStatistics
} from '../controllers/saleDocuments.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

router.get('/', getSaleDocuments);
router.get('/stats/clients', getClientStatistics);
router.get('/client/:clientId', getDocumentsByClient);
router.get('/:id', getSaleDocumentById);
router.get('/:id/status', getOrderStatus);  // 🆕 добавить маршрут
router.post('/', managerAccess, createSaleDocument);
router.put('/:id', managerAccess, updateSaleDocument);
router.patch('/:id/payment-status', managerAccess, updatePaymentStatus);
router.put('/:id/payment', managerAccess, updatePaymentStatus);
router.patch('/:id/status', updateOrderStatus);
router.delete('/:id', managerAccess, deleteSaleDocument);

export default router;