// frontend/src/api/clients.js
import apiClient from './client';

export const clientsApi = {
  // Получить всех клиентов с фильтрацией
  getAll: (params = {}) => {
    const { search, sortBy, sortOrder, page, limit } = params;
    const queryParams = new URLSearchParams();
    if (search) queryParams.append('search', search);
    if (sortBy) queryParams.append('sortBy', sortBy);
    if (sortOrder) queryParams.append('sortOrder', sortOrder);
    if (page) queryParams.append('page', page);
    if (limit) queryParams.append('limit', limit);
    
    const url = `/clients${queryParams.toString() ? '?' + queryParams.toString() : ''}`;
    return apiClient.get(url);
  },
  
  // Получить клиента по ID
  getById: (id) => apiClient.get(`/clients/${id}`),
  
  // Создать клиента
  create: (data) => apiClient.post('/clients', data),
  
  // Обновить клиента
  update: (id, data) => apiClient.put(`/clients/${id}`, data),
  
  // Удалить клиента
  delete: (id) => apiClient.delete(`/clients/${id}`),
  
  // Поиск клиентов для автокомплита
  search: (query) => apiClient.get(`/clients/search?q=${encodeURIComponent(query)}`),
  
  // Получить статистику по клиентам
  getStats: () => apiClient.get('/clients/stats')
};