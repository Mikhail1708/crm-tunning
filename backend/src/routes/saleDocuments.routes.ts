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
  getClientStatistics,
  updateFullOrder,
  createPublicOrder,        // 👈 НОВЫЙ КОНТРОЛЛЕР
} from '../controllers/saleDocuments.controller';
import { authMiddleware, managerAccess } from '../middleware/auth.middleware';
import { requireInternalApiKey } from '../middleware/internalApiKey.middleware';
import { orderLimiter } from '../middleware/rateLimit.middleware';
import {
  consumeInventoryReservation,
  createInventoryReservation,
  expireInventoryReservations,
  releaseInventoryReservation,
} from '../controllers/inventoryReservations.controller';

const router = Router();

// 🔓 ПУБЛИЧНЫЙ ЭНДПОИНТ (без JWT) для создания заказа с сайта
// Ограничение частоты запросов через rate-limit (настраивается отдельно)
router.post('/public', orderLimiter, requireInternalApiKey, createPublicOrder as any);
router.put('/internal/:id/full', orderLimiter, requireInternalApiKey, updateFullOrder as any);
router.post('/internal/v1/reservations', orderLimiter, requireInternalApiKey, createInventoryReservation as any);
router.post('/internal/v1/reservations/expire', orderLimiter, requireInternalApiKey, expireInventoryReservations as any);
router.post('/internal/v1/reservations/:reservationId/release', orderLimiter, requireInternalApiKey, releaseInventoryReservation as any);
router.post('/internal/v1/reservations/:reservationId/consume', orderLimiter, requireInternalApiKey, consumeInventoryReservation as any);

// 🔒 Все остальные маршруты требуют аутентификации
router.use(authMiddleware as any);

router.get('/', getSaleDocuments as any);
router.get('/stats/clients', getClientStatistics as any);
router.get('/client/:clientId', getDocumentsByClient as any);
router.get('/:id', getSaleDocumentById as any);
router.get('/:id/status', getOrderStatus as any);
router.post('/', managerAccess as any, createSaleDocument as any);
router.put('/:id', managerAccess as any, updateSaleDocument as any);
router.put('/:id/full', managerAccess as any, updateFullOrder as any);
router.patch('/:id/payment-status', managerAccess as any, updatePaymentStatus as any);
router.put('/:id/payment', managerAccess as any, updatePaymentStatus as any);
router.patch('/:id/status', updateOrderStatus as any);
router.delete('/:id', managerAccess as any, deleteSaleDocument as any);

export default router;
