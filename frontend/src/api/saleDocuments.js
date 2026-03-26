// frontend/src/api/saleDocuments.js
import apiClient from './client';

export const saleDocumentsApi = {
  getAll: () => apiClient.get('/sale-documents'),
  getById: (id) => apiClient.get(`/sale-documents/${id}`),
  create: (data) => apiClient.post('/sale-documents', data),
  update: (id, data) => apiClient.put(`/sale-documents/${id}`, data),
  delete: (id) => apiClient.delete(`/sale-documents/${id}`),
  // Используем правильный endpoint из вашего бэкенда
  updatePaymentStatus: (id, status) => apiClient.put(`/sale-documents/${id}/payment`, { paymentStatus: status }),
  getByClient: (clientId) => apiClient.get(`/sale-documents/client/${clientId}`),
  getClientStats: () => apiClient.get('/sale-documents/statistics/clients')
};