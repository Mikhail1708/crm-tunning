// frontend/src/api/categories.ts
import { api } from './client';
import { Category, ApiResponse, CategoryField } from '../types';

export interface CreateCategoryData {
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export interface CreateCategoryFieldData {
  name: string;
  fieldType: 'text' | 'number' | 'select' | 'multiselect';
  isRequired?: boolean;
  sortOrder?: number;
  options?: string[];
}

export const categoriesApi = {
  getAll: (): Promise<ApiResponse<Category[]>> =>
    api.get('/categories'),
  
  getById: (id: number): Promise<ApiResponse<Category>> =>
    api.get(`/categories/${id}`),
  
  create: (data: CreateCategoryData): Promise<ApiResponse<Category>> =>
    api.post('/categories', data),
  
  update: (id: number, data: CreateCategoryData): Promise<ApiResponse<Category>> =>
    api.put(`/categories/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<{ message: string }>> =>
    api.delete(`/categories/${id}`),
  
  createField: (categoryId: number, data: CreateCategoryFieldData): Promise<ApiResponse<CategoryField>> =>
    api.post(`/categories/${categoryId}/fields`, data),
  
  updateField: (fieldId: number, data: CreateCategoryFieldData): Promise<ApiResponse<CategoryField>> =>
    api.put(`/categories/fields/${fieldId}`, data),
  
  deleteField: (fieldId: number): Promise<ApiResponse<{ message: string }>> =>
    api.delete(`/categories/fields/${fieldId}`),
};