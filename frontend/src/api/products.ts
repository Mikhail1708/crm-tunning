// frontend/src/api/products.ts
import { api } from './client';
import { Product, ApiResponse, PaginatedResponse } from '../types';

export interface CreateProductData {
  name: string;
  article: string;
  cost_price: number;
  retail_price: number;
  stock: number;
  min_stock: number;
  categoryIds: number[];
  description?: string;
  characteristics?: Record<string, string | number | string[]>;
  costBreakdown?: Array<{ name: string; amount: number; note?: string }>;
}

export type UpdateProductData = Partial<CreateProductData>;

export interface GetProductsParams {
  search?: string;
  categoryId?: number;
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export const productsApi = {
  getAll: (params?: GetProductsParams): Promise<ApiResponse<Product[]>> =>
    api.get('/products', { params }),
  
  getById: (id: number): Promise<ApiResponse<Product>> =>
    api.get(`/products/${id}`),
  
  create: (data: CreateProductData): Promise<ApiResponse<Product>> =>
    api.post('/products', data),
  
  update: (id: number, data: UpdateProductData): Promise<ApiResponse<Product>> =>
    api.put(`/products/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<{ message: string }>> =>
    api.delete(`/products/${id}`),
  
  getLowStock: (): Promise<ApiResponse<Product[]>> =>
    api.get('/products/low-stock'),
};