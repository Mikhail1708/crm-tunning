// frontend/src/api/saleDocuments.ts
import { api } from './client';
import type { OrderStatus } from '../types';

export interface SaleDocument {
  id: number;
  documentNumber: string;
  documentType: 'order' | 'receipt' | 'invoice';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  contactMethod?: string;
  deliveryMethod?: string;
  deliveryProvider?: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  paymentStatus: string;
  orderStatus?: OrderStatus;
  saleDate: string;
  items: SaleDocumentItem[];
  clientName?: string;
  clientPhone?: string;
  sellerName?: string;
}

export interface SaleDocumentItem {
  id: number;
  productId: number;
  productName: string;
  productArticle: string;
  quantity: number;
  price: number;
  total: number;
}

// 🆕 Типы для редактирования заказа
export interface UpdateOrderItemDto {
  id?: number;           // ID существующей позиции (для обновления)
  productId: number;
  quantity: number;
  price: number;
}

export interface UpdateFullOrderDto {
  items: UpdateOrderItemDto[];
  discount: number;
  description?: string;
  clientData?: {
    name: string;
    phone: string;
    email: string;
    city: string;
    address: string;
  };
}

export const saleDocumentsApi = {
  // Получить все документы
  getAll: (params?: any) => api.get('/sale-documents', { params }),
  
  // Получить документ по ID
  getById: (id: number) => api.get(`/sale-documents/${id}`),
  
  // Получить заказы по клиенту
  getByClientId: (clientId: number) => api.get(`/sale-documents/client/${clientId}`),
  
  // Создать новый документ
  create: (data: any) => api.post('/sale-documents', data),
  
  // Обновить документ
  update: (id: number, data: any) => api.put(`/sale-documents/${id}`, data),
  
  // 🆕 Полное обновление заказа (корзина + скидка + клиент)
  updateFullOrder: (id: number, data: UpdateFullOrderDto) => 
    api.put(`/sale-documents/${id}/full`, data),
  
  // Удалить документ
  delete: (id: number) => api.delete(`/sale-documents/${id}`),
  
  // Отметить как оплаченный (обновить статус оплаты)
  updatePaymentStatus: (id: number, status: 'paid' | 'unpaid') => 
    api.put(`/sale-documents/${id}/payment`, { paymentStatus: status }),
  
  // Обновить статус заказа
  updateOrderStatus: (id: number, orderStatus: OrderStatus) => 
    api.patch(`/sale-documents/${id}/status`, { orderStatus }),
  
  getOrderStatus: (id: number) => 
    api.get(`/sale-documents/${id}/status`),

  // Отметить как оплаченный (алиас)
  markAsPaid: (id: number) => api.put(`/sale-documents/${id}/payment`, { paymentStatus: 'paid' }),
  
  // Получить чек
  getReceipt: (id: number) => api.get(`/sale-documents/${id}/receipt`, { responseType: 'blob' }),
  
  // Получить счет
  getInvoice: (id: number) => api.get(`/sale-documents/${id}/invoice`, { responseType: 'blob' }),
  
  // Генерация чека (для печати)
  generateReceipt: (id: number) => api.get(`/sale-documents/${id}/receipt`, { responseType: 'blob' }),
  
  // Генерация счета
  generateInvoice: (id: number) => api.get(`/sale-documents/${id}/invoice`, { responseType: 'blob' }),
};
