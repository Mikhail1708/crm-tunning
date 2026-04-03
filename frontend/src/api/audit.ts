// frontend/src/api/audit.ts
import apiClient from './client';

export interface AuditLog {
  id: number;
  userId: number;
  userEmail: string;
  userRole: string;
  action: string;
  entity?: string;
  entityId?: number;
  details?: any;
  createdAt: string;
}

export interface GetLogsParams {
  userId?: number;
  action?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export const auditApi = {
  // GET /api/audit - список логов с фильтрацией
  getLogs: async (params?: GetLogsParams) => {
    const response = await apiClient.get('/audit', { params });
    return response.data;
  },

  // GET /api/audit/stats - статистика по логам
  getStats: async () => {
    const response = await apiClient.get('/audit/stats');
    return response.data;
  },

  // GET /api/audit/export - экспорт в CSV
  exportLogs: async (params?: Omit<GetLogsParams, 'page' | 'limit'>) => {
    const response = await apiClient.get('/audit/export', { 
      params,
      responseType: 'blob' 
    });
    return response.data;
  },

  // GET /api/audit/recent - последние логи для дашборда
  getRecentLogs: async (limit: number = 20) => {
    const response = await apiClient.get('/audit/recent', { params: { limit } });
    return response.data;
  },

  // POST /api/audit/manual - ручное добавление события
  addManualLog: async (action: string, details?: any) => {
    const response = await apiClient.post('/audit/manual', { action, details });
    return response.data;
  },

  // DELETE /api/audit/clean - очистка старых логов (только админ)
  cleanLogs: async (keepCount: number = 5000) => {
    const response = await apiClient.delete('/audit/clean', { data: { keepCount } });
    return response.data;
  }
};

export default auditApi;