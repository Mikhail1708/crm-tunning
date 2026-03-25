// frontend/src/api/categories.js
import apiClient from './client';

export const categoriesApi = {
  getAll: () => apiClient.get('/categories'),
  getById: (id) => apiClient.get(`/categories/${id}`),
  create: (data) => apiClient.post('/categories', data),
  update: (id, data) => apiClient.put(`/categories/${id}`, data),
  delete: (id) => apiClient.delete(`/categories/${id}`),
  getFields: (categoryId) => apiClient.get(`/categories/${categoryId}/fields`),
  createField: (categoryId, data) => apiClient.post(`/categories/${categoryId}/fields`, data),
  updateField: (fieldId, data) => apiClient.put(`/categories/fields/${fieldId}`, data),
  deleteField: (fieldId) => apiClient.delete(`/categories/fields/${fieldId}`)
};