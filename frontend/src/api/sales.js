// frontend/src/api/sales.js
import apiClient from './client';

export const salesApi = {
  getAll: () => apiClient.get('/sales'),
  getById: (id) => apiClient.get(`/sales/${id}`),
  create: (data) => apiClient.post('/sales', data),
  delete: (id) => apiClient.delete(`/sales/${id}`)
};