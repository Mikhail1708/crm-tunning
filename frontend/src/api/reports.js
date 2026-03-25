// frontend/src/api/reports.js
import apiClient from './client';

export const reportsApi = {
  getSummary: () => apiClient.get('/reports/summary'),
  getProfitByProduct: () => apiClient.get('/reports/profit-by-product'),
  getProfitChart: () => apiClient.get('/reports/profit-chart'),
  getExpenses: () => apiClient.get('/reports/expenses'),
  createExpense: (data) => apiClient.post('/reports/expenses', data),
  getOrdersByPeriod: (startDate, endDate) => {
    const params = new URLSearchParams();
    if (startDate) params.append('startDate', startDate);
    if (endDate) params.append('endDate', endDate);
    return apiClient.get(`/reports/orders?${params.toString()}`);
  },
  deleteAllSales: () => apiClient.delete('/reports/sales/all'),
  getSalesStats: (period) => apiClient.get(`/reports/stats/${period}`),
  
  // Методы для работы с дампом
  getDatabaseDump: () => apiClient.get('/reports/dump'),
  restoreDatabase: (dumpData) => apiClient.post('/reports/restore', dumpData),
  clearDatabase: () => apiClient.delete('/reports/clear-all')
};