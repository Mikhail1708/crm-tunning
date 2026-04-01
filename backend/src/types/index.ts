// backend/src/types/index.ts
import { Request } from 'express';

// Тип для пользователя в запросе
export interface RequestWithUser extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
}

// DTO для товаров
export interface CreateProductDTO {
  name: string;
  article?: string;
  cost_price: number;
  retail_price: number;
  stock: number;
  min_stock?: number;
  description?: string;
  image_url?: string;
  categoryIds?: number[];
  characteristics?: Record<string, string>;
  costBreakdown?: any;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {}

// DTO для категорий
export interface CreateCategoryDTO {
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export interface CreateCategoryFieldDTO {
  name: string;
  fieldType: 'text' | 'number' | 'select' | 'multiselect';
  isRequired?: boolean;
  sortOrder?: number;
  options?: string[];
}

// DTO для клиентов
export interface CreateClientDTO {
  firstName: string;
  lastName?: string;
  middleName?: string;
  phone: string;
  email?: string;
  birthDate?: Date | string;
  address?: string;
  city?: string;
  passport?: string;
  driverLicense?: string;
  carModel?: string;
  carYear?: number;
  carVin?: string;
  carNumber?: string;
  notes?: string;
}

export interface UpdateClientDTO extends Partial<CreateClientDTO> {}

// DTO для документов продаж
export interface CreateSaleDocumentDTO {
  documentType: 'order' | 'receipt' | 'invoice';
  clientId?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items: Array<{
    productId: number;
    quantity: number;
    price: number;
  }>;
  discount?: number;
  paymentMethod?: string;
  paymentStatus?: string;
}

// DTO для продаж (устаревший, но оставляем для обратной совместимости)
export interface CreateSaleDTO {
  productId: number;
  quantity: number;
  selling_price: number;
  customer_name?: string;
  customer_phone?: string;
}

// Типы для ответов
export interface ApiResponse<T = any> {
  data?: T;
  error?: string;
  message?: string;
}

// Типы для статистики
export interface SalesStats {
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  averageCheck: number;
  margin: number;
}

// Типы для отчета по товарам
export interface ProductProfitReport {
  id: number;
  name: string;
  article: string | null;
  cost_price: number;
  retail_price: number;
  stock: number;
  min_stock: number;
  category: string;
  total_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  margin_percent: number;
}

// Типы для расхода
export interface CreateExpenseDTO {
  name: string;
  amount: number;
  category: string;
  description?: string;
  expense_date?: Date;
}