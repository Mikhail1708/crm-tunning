// backend/src/services/audit.service.ts
import fs from 'fs';
import path from 'path';

export interface LogEntry {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  action: string;
  details: any;
  ip?: string;
  userAgent?: string;
  createdAt: Date;
}

class AuditService {
  private logs: LogEntry[] = [];
  private readonly MAX_LOGS = 10000;
  private readonly LOG_FILE: string;
  private saveTimeout: NodeJS.Timeout | null = null;

  constructor() {
    // Определяем путь к файлу логов
    this.LOG_FILE = path.join(process.cwd(), 'logs', 'audit.log');
    
    // Создаем директорию если её нет
    const logDir = path.dirname(this.LOG_FILE);
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    
    // Загружаем логи из файла при старте
    this.loadLogsFromFile();
  }

  /**
   * Загрузка логов из файла
   */
  private loadLogsFromFile(): void {
    try {
      if (fs.existsSync(this.LOG_FILE)) {
        const data = fs.readFileSync(this.LOG_FILE, 'utf-8');
        const lines = data.trim().split('\n').filter(line => line.trim());
        
        this.logs = lines.map(line => {
          try {
            return JSON.parse(line);
          } catch {
            return null;
          }
        }).filter(log => log !== null).slice(0, this.MAX_LOGS);
        
        // Восстанавливаем даты
        this.logs.forEach(log => {
          log.createdAt = new Date(log.createdAt);
        });
        
        console.log(`📂 Загружено ${this.logs.length} логов из файла`);
      } else {
        console.log('📂 Файл логов не найден, будет создан новый');
      }
    } catch (error) {
      console.error('❌ Ошибка загрузки логов из файла:', error);
      this.logs = [];
    }
  }

  /**
   * Асинхронное сохранение лога в файл (одна строка = один лог)
   */
  private appendLogToFile(logEntry: LogEntry): void {
    try {
      const logString = JSON.stringify({
        ...logEntry,
        createdAt: logEntry.createdAt.toISOString()
      });
      
      // Добавляем одну строку в конец файла
      fs.appendFileSync(this.LOG_FILE, logString + '\n');
    } catch (error) {
      console.error('❌ Ошибка записи лога в файл:', error);
    }
  }

  /**
   * Логирование действия пользователя
   */
  async log(
    user: { id: number; name: string; role: string },
    action: string,
    details?: any,
    ip?: string,
    userAgent?: string
  ): Promise<LogEntry> {
    const logEntry: LogEntry = {
      id: Date.now(),
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      details,
      ip,
      userAgent,
      createdAt: new Date()
    };
    
    // Добавляем в начало массива (новые сверху)
    this.logs.unshift(logEntry);
    
    // Ограничиваем количество логов в памяти
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }
    
    // Записываем в файл (одна строка)
    this.appendLogToFile(logEntry);
    
    console.log(`📝 LOG: ${user.name} | ${action}`);
    
    return logEntry;
  }
  
  /**
   * Получить логи с фильтрацией
   */
  getLogs(filters: {
    userId?: number | null;
    action?: string;
    fromDate?: string;
    toDate?: string;
    page?: number;
    limit?: number;
  }): { logs: LogEntry[]; total: number } {
    let filtered = [...this.logs];
    
    if (filters.userId) {
      filtered = filtered.filter(log => log.userId === filters.userId);
    }
    
    if (filters.action) {
      const actionLower = filters.action.toLowerCase();
      filtered = filtered.filter(log => log.action.toLowerCase().includes(actionLower));
    }
    
    if (filters.fromDate) {
      const from = new Date(filters.fromDate);
      from.setHours(0, 0, 0, 0);
      filtered = filtered.filter(log => log.createdAt >= from);
    }
    
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      to.setHours(23, 59, 59, 999);
      filtered = filtered.filter(log => log.createdAt <= to);
    }
    
    const total = filtered.length;
    const page = filters.page || 1;
    const limit = Math.min(filters.limit || 100, 500);
    const start = (page - 1) * limit;
    const logs = filtered.slice(start, start + limit);
    
    return { logs, total };
  }
  
  /**
   * Получить статистику по логам
   */
  getStats(): {
    total: number;
    byUser: { userId: number; userName: string; count: number }[];
    byAction: { action: string; count: number }[];
    lastDay: number;
    lastWeek: number;
    lastMonth: number;
  } {
    const now = new Date();
    const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    const oneMonthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    
    const byUserMap = new Map<number, { userId: number; userName: string; count: number }>();
    const byActionMap = new Map<string, number>();
    
    let lastDay = 0;
    let lastWeek = 0;
    let lastMonth = 0;
    
    for (const log of this.logs) {
      if (log.createdAt >= oneDayAgo) lastDay++;
      if (log.createdAt >= oneWeekAgo) lastWeek++;
      if (log.createdAt >= oneMonthAgo) lastMonth++;
      
      if (!byUserMap.has(log.userId)) {
        byUserMap.set(log.userId, {
          userId: log.userId,
          userName: log.userName,
          count: 0
        });
      }
      byUserMap.get(log.userId)!.count++;
      
      const actionKey = log.action;
      byActionMap.set(actionKey, (byActionMap.get(actionKey) || 0) + 1);
    }
    
    return {
      total: this.logs.length,
      byUser: Array.from(byUserMap.values()).sort((a, b) => b.count - a.count),
      byAction: Array.from(byActionMap.entries()).map(([action, count]) => ({ action, count })).sort((a, b) => b.count - a.count),
      lastDay,
      lastWeek,
      lastMonth
    };
  }
  
  /**
   * Получить последние логи
   */
  getRecent(limit: number = 20): LogEntry[] {
    return this.logs.slice(0, limit);
  }
  
  /**
   * Экспорт в CSV
   */
  exportToCSV(filters?: {
    userId?: number | null;
    action?: string;
    fromDate?: string;
    toDate?: string;
  }): string {
    let logs = [...this.logs];
    
    if (filters) {
      if (filters.userId) {
        logs = logs.filter(log => log.userId === filters.userId);
      }
      if (filters.action) {
        const actionLower = filters.action.toLowerCase();
        logs = logs.filter(log => log.action.toLowerCase().includes(actionLower));
      }
      if (filters.fromDate) {
        const from = new Date(filters.fromDate);
        from.setHours(0, 0, 0, 0);
        logs = logs.filter(log => log.createdAt >= from);
      }
      if (filters.toDate) {
        const to = new Date(filters.toDate);
        to.setHours(23, 59, 59, 999);
        logs = logs.filter(log => log.createdAt <= to);
      }
    }
    
    const headers = ['Дата', 'Пользователь', 'Роль', 'Действие', 'Детали', 'IP'];
    const rows = logs.map(log => [
      log.createdAt.toLocaleString('ru-RU'),
      log.userName,
      log.userRole === 'admin' ? 'Администратор' : 'Менеджер',
      log.action,
      JSON.stringify(log.details || {}, null, 2).replace(/\n/g, ' ').replace(/,/g, ';'),
      log.ip || '-'
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${String(cell).replace(/"/g, '""')}"`).join(',')).join('\n');
    return '\uFEFF' + csv;
  }
  
  /**
   * Очистить старые логи
   */
  cleanOldLogs(keepCount: number = 5000): { removed: number } {
    const removed = Math.max(0, this.logs.length - keepCount);
    this.logs = this.logs.slice(0, keepCount);
    
    // Перезаписываем файл
    try {
      const logStrings = this.logs.map(log => JSON.stringify({
        ...log,
        createdAt: log.createdAt.toISOString()
      }));
      fs.writeFileSync(this.LOG_FILE, logStrings.join('\n') + (logStrings.length ? '\n' : ''));
    } catch (error) {
      console.error('❌ Ошибка перезаписи файла логов:', error);
    }
    
    return { removed };
  }
  
  /**
   * Получить все логи (для отладки)
   */
  getAllLogs(): LogEntry[] {
    return [...this.logs];
  }
  
  /**
   * Получить путь к файлу логов
   */
  getLogFilePath(): string {
    return this.LOG_FILE;
  }
}

const auditService = new AuditService();
export default auditService;