// backend/src/routes/audit.routes.ts
import { Router } from 'express';
import {
  getLogs,
  getLogsStats,
  exportLogs,
  addManualLog,
  cleanLogs,
  getRecentLogs
} from '../controllers/audit.controller';
import { authMiddleware, adminMiddleware } from '../middleware/auth.middleware';

const router = Router();

// Все маршруты требуют аутентификации
router.use(authMiddleware);

router.get('/', getLogs);
router.get('/stats', getLogsStats);
router.get('/export', exportLogs);
router.get('/recent', getRecentLogs);
router.post('/manual', addManualLog);
router.delete('/clean', adminMiddleware, cleanLogs);

export default router;