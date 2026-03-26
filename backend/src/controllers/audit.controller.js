// backend/src/controllers/audit.controller.js
const auditService = require('../services/audit.service');

// Получить список логов
const getLogs = async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate,
      page: parseInt(req.query.page) || 1,
      limit: Math.min(parseInt(req.query.limit) || 100, 500)
    };
    
    const result = auditService.getLogs(filters);
    res.json(result);
  } catch (error) {
    console.error('Error getting logs:', error);
    res.status(500).json({ message: 'Ошибка загрузки логов' });
  }
};

// Получить статистику по логам
const getLogsStats = async (req, res) => {
  try {
    const stats = auditService.getStats();
    res.json(stats);
  } catch (error) {
    console.error('Error getting logs stats:', error);
    res.status(500).json({ message: 'Ошибка загрузки статистики' });
  }
};

// Экспорт логов в CSV
const exportLogs = async (req, res) => {
  try {
    const filters = {
      userId: req.query.userId ? parseInt(req.query.userId) : null,
      action: req.query.action,
      fromDate: req.query.fromDate,
      toDate: req.query.toDate
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

// Ручное добавление события
const addManualLog = async (req, res) => {
  try {
    const { action, details } = req.body;
    const user = req.user;
    
    const log = auditService.log(user, action, details);
    res.json(log);
  } catch (error) {
    console.error('Error adding manual log:', error);
    res.status(500).json({ message: 'Ошибка добавления лога' });
  }
};

// Очистить старые логи (только для админа)
const cleanLogs = async (req, res) => {
  try {
    const { keepCount = 5000 } = req.body;
    const result = auditService.cleanOldLogs(keepCount);
    
    // Логируем очистку логов
    auditService.log(req.user, 'Очистка старых логов', { keepCount, result });
    
    res.json({ message: `Логи очищены, оставлено ${keepCount} записей` });
  } catch (error) {
    console.error('Error cleaning logs:', error);
    res.status(500).json({ message: 'Ошибка очистки логов' });
  }
};

// Получить последние логи для дашборда
const getRecentLogs = async (req, res) => {
  try {
    const limit = Math.min(parseInt(req.query.limit) || 20, 100);
    const logs = auditService.getRecent(limit);
    res.json(logs);
  } catch (error) {
    console.error('Error getting recent logs:', error);
    res.status(500).json({ message: 'Ошибка загрузки логов' });
  }
};

module.exports = {
  getLogs,
  getLogsStats,
  exportLogs,
  addManualLog,
  cleanLogs,
  getRecentLogs
};