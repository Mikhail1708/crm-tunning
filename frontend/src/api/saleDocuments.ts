// frontend/src/api/saleDocuments.ts
import { api } from './client';
import { SaleDocument, ApiResponse } from '../types';

export interface CreateSaleDocumentItem {
  productId: number;
  quantity: number;
  price: number;
}

export interface CreateSaleDocumentData {
  documentType: 'order' | 'receipt' | 'invoice';
  clientId?: number | null;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: CreateSaleDocumentItem[];
  discount?: number;
  paymentMethod?: string;
  paymentStatus?: 'paid' | 'unpaid';
}

export const saleDocumentsApi = {
  getAll: (): Promise<ApiResponse<SaleDocument[]>> =>
    api.get('/sale-documents'),
  
  getById: (id: number | string): Promise<ApiResponse<SaleDocument>> =>
    api.get(`/sale-documents/${id}`),
  
  create: (data: CreateSaleDocumentData): Promise<ApiResponse<{ document: SaleDocument }>> =>
    api.post('/sale-documents', data),
  
  update: (id: number, data: Partial<CreateSaleDocumentData>): Promise<ApiResponse<SaleDocument>> =>
    api.put(`/sale-documents/${id}`, data),
  
  delete: (id: number): Promise<ApiResponse<{ message: string }>> =>
    api.delete(`/sale-documents/${id}`),
  
  updatePaymentStatus: (id: number, status: 'paid' | 'unpaid'): Promise<ApiResponse<SaleDocument>> =>
    api.put(`/sale-documents/${id}/payment`, { paymentStatus: status }),
};