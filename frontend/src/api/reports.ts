// frontend/src/api/reports.ts
import { api } from './client';
import { ApiResponse, ReportSummary, ProductStat, ClientStat, CityStat } from '../types';

export interface DatabaseDump {
  exportedAt: string;
  version: string;
  data: {
    categories: unknown[];
    products: unknown[];
    clients: unknown[];
    saleDocuments: unknown[];
    sales: unknown[];
    expenses: unknown[];
  };
}

export const reportsApi = {
  getSummary: (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<ReportSummary>> =>
    api.get('/reports/summary', { params }),
  
  getProfitByProduct: (): Promise<ApiResponse<ProductStat[]>> =>
    api.get('/reports/profit-by-product'),
  
  getProfitChart: (params?: { startDate?: string; endDate?: string }): Promise<ApiResponse<Array<{ date: string; revenue: number; profit: number }>>> =>
    api.get('/reports/profit-chart', { params }),
  
  getExpenses: (): Promise<ApiResponse<unknown[]>> =>
    api.get('/reports/expenses'),
  
  createExpense: (data: { name: string; amount: number; category: string; date?: string; description?: string }): Promise<ApiResponse<unknown>> =>
    api.post('/reports/expenses', data),
  
  getDatabaseDump: (): Promise<ApiResponse<DatabaseDump>> =>
    api.get('/reports/dump'),
  
  restoreDatabase: (dump: DatabaseDump): Promise<ApiResponse<{ message: string }>> =>
    api.post('/reports/restore', dump),
  
  clearDatabase: (): Promise<ApiResponse<{ message: string }>> =>
    api.delete('/reports/clear-all'),
};