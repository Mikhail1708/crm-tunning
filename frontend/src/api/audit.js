// frontend/src/api/audit.js
import apiClient from './client';

export const auditApi = {
  // Получить логи
  getLogs: (params) => apiClient.get('/audit', { params }),
  
  // Получить статистику
  getStats: () => apiClient.get('/audit/stats'),
  
  // Экспорт в CSV
  exportLogs: (params) => apiClient.get('/audit/export', { 
    params, 
    responseType: 'blob' 
  }),
  
  // Получить последние логи
  getRecentLogs: (limit = 20) => apiClient.get('/audit/recent', { params: { limit } }),
  
  // Добавить ручной лог
  addManualLog: (data) => apiClient.post('/audit/manual', data),
  
  // Очистить старые логи
  cleanLogs: (keepCount = 5000) => apiClient.post('/audit/clean', { keepCount })
};