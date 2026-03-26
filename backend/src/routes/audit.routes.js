// backend/src/routes/audit.routes.js
const express = require('express');
const router = express.Router();
const auditController = require('../controllers/audit.controller');
const { authMiddleware, adminMiddleware } = require('../middleware/auth.middleware');

// Все маршруты требуют аутентификации
router.use(authMiddleware);

// Получение логов (только для админов)
router.get('/', adminMiddleware, auditController.getLogs);
router.get('/stats', adminMiddleware, auditController.getLogsStats);
router.get('/export', adminMiddleware, auditController.exportLogs);
router.get('/recent', auditController.getRecentLogs);

// Управление логами (только для админов)
router.post('/manual', adminMiddleware, auditController.addManualLog);
router.post('/clean', adminMiddleware, auditController.cleanLogs);

module.exports = router;