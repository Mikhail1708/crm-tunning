// backend/src/routes/saleDocuments.routes.js
const express = require('express');
const router = express.Router();
const saleDocumentsController = require('../controllers/saleDocuments.controller');
const { authMiddleware } = require('../middleware/auth.middleware');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Маршруты
router.get('/', saleDocumentsController.getSaleDocuments);
router.get('/client/:clientId', saleDocumentsController.getDocumentsByClient);
router.get('/statistics/clients', saleDocumentsController.getClientStatistics);
router.get('/:id', saleDocumentsController.getSaleDocumentById);
router.post('/', saleDocumentsController.createSaleDocument);
router.put('/:id', saleDocumentsController.updateSaleDocument);
router.put('/:id/payment', saleDocumentsController.updatePaymentStatus);
router.delete('/:id', saleDocumentsController.deleteSaleDocument);

module.exports = router;