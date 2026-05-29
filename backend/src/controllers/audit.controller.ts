// backend/src/controllers/audit.controller.ts
import { Response } from 'express';
import { RequestWithUser } from '../types';
import auditService from '../services/audit.service';

/**
 * GET /api/audit
 * Получить список логов
 */
export const getLogs = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId as string) : null,
      action: req.query.action as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string,
      page: parseInt(req.query.page as string) || 1,
      limit: Math.min(parseInt(req.query.limit as string) || 100, 500)
    };
    
    const result = auditService.getLogs(filters);
    res.json(result);
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ message: 'Ошибка загрузки логов' });
  }
};

/**
 * GET /api/audit/stats
 * Получить статистику по логам
 */
export const getLogsStats = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const stats = auditService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting logs stats:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики' });
  }
};

/**
 * GET /api/audit/export
 * Экспорт логов в CSV
 */
export const exportLogs = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId as string) : null,
      action: req.query.action as string,
      fromDate: req.query.fromDate as string,
      toDate: req.query.toDate as string
    };
    
    const csv = auditService.exportToCSV(filters);
    
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename=audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
    res.send('\uFEFF' + csv);
  } catch (error) {
    console.error('Error exporting logs:', error);
    res.status(500).json({ message: 'Ошибка экспорта логов' });
  }
};

/**
 * POST /api/audit/manual
 * Ручное добавление события
 */
export const addManualLog = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const { action, details } = req.body;
    const user = req.user;
    
    if (!user) {
      res.status(401).json({ message: 'Не авторизован' });
      return;
    }
    
    const log = auditService.log(user, action, details);
    res.json(log);
  } catch (error) {
    console.error('Error adding manual log:', error);
    res.status(500).json({ message: 'Ошибка добавления лога' });
  }
};

/**
 * DELETE /api/audit/clean
 * Очистить старые логи (только для админа)
 */
export const cleanLogs = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    if (req.user?.role !== 'admin') {
      res.status(403).json({ message: 'Доступ запрещен. Требуются права администратора' });
      return;
    }
    
    const { keepCount = 5000 } = req.body;
    const result = auditService.cleanOldLogs(keepCount);
    
    // Логируем очистку логов
    if (req.user) {
      auditService.log(req.user, 'Очистка старых логов', { keepCount, result });
    }
    
    res.json({ message: `Логи очищены, оставлено ${keepCount} записей` });
  } catch (error) {
    console.error('Error cleaning logs:', error);
    res.status(500).json({ message: 'Ошибка очистки логов' });
  }
};

/**
 * GET /api/audit/recent
 * Получить последние логи для дашборда
 */
export const getRecentLogs = async (req: RequestWithUser, res: Response): Promise<void> => {
  try {
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const logs = auditService.getRecent(limit);
    res.json(logs);
  } catch (error) {
    console.error('Error getting recent logs:', error);
    res.status(500).json({ message: 'Ошибка загрузки логов' });
  }
};