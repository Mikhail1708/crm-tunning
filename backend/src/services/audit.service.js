// backend/src/services/audit.service.js
const fs = require('fs');
const path = require('path');

// Путь к файлу логов
const LOGS_DIR = path.join(__dirname, '../../logs');
const LOG_FILE = path.join(LOGS_DIR, 'audit.log');

// Убеждаемся, что папка logs существует
if (!fs.existsSync(LOGS_DIR)) {
  fs.mkdirSync(LOGS_DIR, { recursive: true });
}

class AuditService {
  constructor() {
    this.logs = [];
    this.loadLogs();
  }

  // Загрузка логов из файла
  loadLogs() {
    try {
      if (fs.existsSync(LOG_FILE)) {
        const data = fs.readFileSync(LOG_FILE, 'utf8');
        this.logs = data.split('\n')
          .filter(line => line.trim())
          .map(line => {
            try {
              return JSON.parse(line);
            } catch (e) {
              return null;
            }
          })
          .filter(log => log !== null);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
      this.logs = [];
    }
  }

  // Сохранение логов в файл
  saveLogs() {
    try {
      const data = this.logs.map(log => JSON.stringify(log)).join('\n');
      fs.writeFileSync(LOG_FILE, data, 'utf8');
    } catch (error) {
      console.error('Error saving logs:', error);
    }
  }

  // Запись события
  log(user, action, details = {}) {
    const logEntry = {
      id: Date.now() + '-' + Math.random().toString(36).substr(2, 9),
      timestamp: new Date().toISOString(),
      user: {
        id: user?.id || null,
        email: user?.email || 'system',
        name: user?.name || 'Система',
        role: user?.role || 'system'
      },
      action: action,
      details: details,
      ip: details.ip || null,
      userAgent: details.userAgent || null
    };

    this.logs.unshift(logEntry); // Добавляем в начало (новые сверху)
    
    // Ограничиваем количество логов (храним последние 10000)
    if (this.logs.length > 10000) {
      this.logs = this.logs.slice(0, 10000);
    }
    
    this.saveLogs();
    return logEntry;
  }

  // Получить все логи с фильтрацией
  getLogs(filters = {}) {
    let filtered = [...this.logs];
    
    // Фильтр по пользователю
    if (filters.userId) {
      filtered = filtered.filter(log => log.user.id === filters.userId);
    }
    
    // Фильтр по действию
    if (filters.action) {
      filtered = filtered.filter(log => log.action.includes(filters.action));
    }
    
    // Фильтр по дате (с)
    if (filters.fromDate) {
      const fromDate = new Date(filters.fromDate);
      filtered = filtered.filter(log => new Date(log.timestamp) >= fromDate);
    }
    
    // Фильтр по дате (по)
    if (filters.toDate) {
      const toDate = new Date(filters.toDate);
      filtered = filtered.filter(log => new Date(log.timestamp) <= toDate);
    }
    
    // Пагинация
    const page = filters.page || 1;
    const limit = filters.limit || 100;
    const start = (page - 1) * limit;
    const end = start + limit;
    
    return {
      total: filtered.length,
      page: page,
      limit: limit,
      logs: filtered.slice(start, end)
    };
  }

  // Получить статистику по логам
  getStats() {
    const stats = {
      total: this.logs.length,
      byAction: {},
      byUser: {},
      byDate: {}
    };
    
    // Статистика по действиям
    this.logs.forEach(log => {
      stats.byAction[log.action] = (stats.byAction[log.action] || 0) + 1;
      stats.byUser[log.user.email] = (stats.byUser[log.user.email] || 0) + 1;
      
      const date = log.timestamp.split('T')[0];
      stats.byDate[date] = (stats.byDate[date] || 0) + 1;
    });
    
    return stats;
  }

  // Экспорт логов в CSV
  exportToCSV(filters = {}) {
    const { logs } = this.getLogs({ ...filters, limit: 10000 });
    
    const headers = ['ID', 'Дата и время', 'Пользователь', 'Email', 'Действие', 'Детали', 'IP'];
    const rows = logs.map(log => [
      log.id,
      new Date(log.timestamp).toLocaleString('ru-RU'),
      log.user.name,
      log.user.email,
      log.action,
      JSON.stringify(log.details, null, 2).replace(/\n/g, ' '),
      log.ip || ''
    ]);
    
    const csv = [headers, ...rows].map(row => 
      row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')
    ).join('\n');
    
    return csv;
  }

  // Очистить старые логи (оставить последние N)
  cleanOldLogs(keepCount = 5000) {
    if (this.logs.length > keepCount) {
      this.logs = this.logs.slice(0, keepCount);
      this.saveLogs();
    }
  }

  // Получить последние N логов
  getRecent(limit = 50) {
    return this.logs.slice(0, limit);
  }
}

module.exports = new AuditService();