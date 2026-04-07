// frontend/src/api/clients.ts
import { api } from './client';
import { Client, ApiResponse, PaginatedResponse } from '../types';

export interface CreateClientData {
  firstName: string;
  lastName?: string;
  middleName?: string;
  phone: string;
  email?: string;
  birthDate?: string;
  city?: string;
  address?: string;
  carModel?: string;
  carYear?: string;
  carNumber?: string;
  carVin?: string;
  notes?: string;
  discountPercent?: number;  // 🆕 Скидка при создании
}

export type UpdateClientData = Partial<CreateClientData>;

export interface GetClientsParams {
  search?: string;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const clientsApi = {
  getAll: (params?: GetClientsParams): Promise<ApiResponse<Client[] | PaginatedResponse<Client>>> =>
  api.get('/clients', { params }),
  
  getById: (id: number): Promise<ApiResponse<Client>> =>
    api.get(`/clients/${id}`),
  
  create: (data: CreateClientData): Promise<ApiResponse<Client>> =>
    api.post('/clients', data),
  
  update: (id: number, data: UpdateClientData): Promise<ApiResponse<Client>> =>
    api.put(`/clients/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<{ message: string }>> =>
    api.delete(`/clients/${id}`),
  
  search: (query: string): Promise<ApiResponse<{ clients: Client[] }>> =>
    api.get(`/clients/search?q=${encodeURIComponent(query)}`),
  
  getStats: (): Promise<ApiResponse<{
    totalClients: number;
    totalSpent: number;
    newClientsThisMonth: number;
    topClients: Client[];
  }>> => api.get('/clients/stats'),

  // 🆕 Обновить только скидку клиента
  updateDiscount: (id: number, discountPercent: number): Promise<ApiResponse<{ 
    message: string; 
    client: { id: number; discountPercent: number; discountUpdatedAt: string | null } 
  }>> => api.patch(`/clients/${id}/discount`, { discountPercent }),
};