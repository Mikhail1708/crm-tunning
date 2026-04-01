// backend/src/services/audit.service.ts
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

interface LogEntry {
  id?: number;
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
  
  /**
   * Логирование действия пользователя
   */
  async log(
    user: { id: number; name: string; role: string },
    action: string,
    details?: any
  ): Promise<LogEntry> {
    const logEntry: LogEntry = {
      userId: user.id,
      userName: user.name,
      userRole: user.role,
      action,
      details,
      createdAt: new Date()
    };
    
    // Сохраняем в массив (временное хранилище)
    this.logs.unshift(logEntry);
    
    // Ограничиваем размер
    if (this.logs.length > this.MAX_LOGS) {
      this.logs.pop();
    }
    
    // TODO: Сохранять в базу данных при необходимости
    // await prisma.auditLog.create({ data: logEntry });
    
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
      filtered = filtered.filter(log => log.action.includes(filters.action!));
    }
    
    if (filters.fromDate) {
      const from = new Date(filters.fromDate);
      filtered = filtered.filter(log => log.createdAt >= from);
    }
    
    if (filters.toDate) {
      const to = new Date(filters.toDate);
      filtered = filtered.filter(log => log.createdAt <= to);
    }
    
    const total = filtered.length;
    const page = filters.page || 1;
    const limit = filters.limit || 100;
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
  } {
    const byUserMap = new Map<number, { userId: number; userName: string; count: number }>();
    const byActionMap = new Map<string, number>();
    
    for (const log of this.logs) {
      // По пользователям
      if (!byUserMap.has(log.userId)) {
        byUserMap.set(log.userId, {
          userId: log.userId,
          userName: log.userName,
          count: 0
        });
      }
      byUserMap.get(log.userId)!.count++;
      
      // По действиям
      const actionKey = log.action;
      byActionMap.set(actionKey, (byActionMap.get(actionKey) || 0) + 1);
    }
    
    const byUser = Array.from(byUserMap.values()).sort((a, b) => b.count - a.count);
    const byAction = Array.from(byActionMap.entries()).map(([action, count]) => ({ action, count }));
    
    return {
      total: this.logs.length,
      byUser,
      byAction
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
        logs = logs.filter(log => log.action.includes(filters.action!));
      }
      if (filters.fromDate) {
        const from = new Date(filters.fromDate);
        logs = logs.filter(log => log.createdAt >= from);
      }
      if (filters.toDate) {
        const to = new Date(filters.toDate);
        logs = logs.filter(log => log.createdAt <= to);
      }
    }
    
    const headers = ['Дата', 'Пользователь', 'Действие', 'Детали'];
    const rows = logs.map(log => [
      log.createdAt.toLocaleString('ru-RU'),
      `${log.userName} (${log.userRole})`,
      log.action,
      JSON.stringify(log.details)
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    return csv;
  }
  
  /**
   * Очистить старые логи
   */
  cleanOldLogs(keepCount: number = 5000): { removed: number } {
    const removed = Math.max(0, this.logs.length - keepCount);
    this.logs = this.logs.slice(0, keepCount);
    return { removed };
  }
}

export default new AuditService();