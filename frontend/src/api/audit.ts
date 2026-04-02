// frontend/src/api/audit.ts
import { api } from './client';
import { AuditLog, ApiResponse, PaginatedResponse } from '../types';

export interface GetLogsParams {
  action?: string;
  fromDate?: string;
  toDate?: string;
  page?: number;
  limit?: number;
}

export const auditApi = {
  getLogs: (params?: GetLogsParams): Promise<ApiResponse<PaginatedResponse<AuditLog>>> =>
    api.get('/audit/logs', { params }),
  
  getStats: (): Promise<ApiResponse<{
    total: number;
    byAction: Record<string, number>;
    byUser: Record<string, number>;
    byDate: Record<string, number>;
  }>> => api.get('/audit/stats'),
  
  exportLogs: (params?: GetLogsParams): Promise<AxiosResponse<Blob>> =>
    api.get('/audit/export', { params, responseType: 'blob' }),
  
  cleanLogs: (keepLast?: number): Promise<ApiResponse<{ message: string }>> =>
    api.delete('/audit/clean', { data: { keepLast } }),
};