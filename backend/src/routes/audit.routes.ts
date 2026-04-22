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

router.use(authMiddleware as any);

router.get('/', getLogs as any);
router.get('/stats', getLogsStats as any);
router.get('/export', exportLogs as any);
router.get('/recent', getRecentLogs as any);
router.post('/manual', addManualLog as any);
router.delete('/clean', adminMiddleware as any, cleanLogs as any);

export default router;