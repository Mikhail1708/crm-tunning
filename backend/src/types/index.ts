<<<<<<< HEAD
// backend/src/types/index.ts
import { Request } from 'express';
import { Multer } from 'multer';

// Тип для пользователя в запросе
=======
import { Request } from 'express';

>>>>>>> feature/edit-order
export interface RequestWithUser extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
<<<<<<< HEAD
  file?: Multer.File;  // 👈 ДОБАВИТЬ для загрузки файлов
  files?: Multer.File[]; // 👈 ДОБАВИТЬ для множественных файлов
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

export interface UpdateProductDTO {
  name?: string;
  article?: string;
  cost_price?: number;
  retail_price?: number;
  stock?: number;
  min_stock?: number;
  description?: string;
  image_url?: string;
  categoryIds?: number[];
  characteristics?: Record<string, string | number | string[]>;
  costBreakdown?: any;
  priceChangeReason?: string; // ДОБАВЬТЕ ЭТУ СТРОКУ
=======
>>>>>>> feature/edit-order
}

// DTO для категорий
export interface CreateCategoryDTO {
  name: string;
  description?: string;
  icon?: string;
  sortOrder?: number;
}

export interface CreateCategoryFieldDTO {
  name: string;
<<<<<<< HEAD
  fieldType: 'text' | 'number' | 'select' | 'multiselect';
  isRequired?: boolean;
  sortOrder?: number;
  options?: string[];
=======
  fieldType: string;
  isRequired?: boolean;
  sortOrder?: number;
  options?: string;
>>>>>>> feature/edit-order
}

// DTO для клиентов
export interface CreateClientDTO {
  firstName: string;
  lastName?: string;
  middleName?: string;
  phone: string;
  email?: string;
<<<<<<< HEAD
  birthDate?: Date | string;
  address?: string;
  city?: string;
=======
  city?: string;
  birthDate?: Date;
  address?: string;
>>>>>>> feature/edit-order
  passport?: string;
  driverLicense?: string;
  carModel?: string;
  carYear?: number;
  carVin?: string;
  carNumber?: string;
  notes?: string;
  discountPercent?: number;
}

<<<<<<< HEAD
export interface UpdateClientDTO extends Partial<CreateClientDTO> {}

// DTO для обновления скидки клиента
export interface UpdateClientDiscountDTO {
  discountPercent: number;
}

// DTO для документов продаж
export interface CreateSaleDocumentDTO {
  documentType: 'order' | 'receipt' | 'invoice';
  clientId?: number;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  description?: string;
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
=======
export interface UpdateClientDiscountDTO {
  discountPercent: number;
  reason?: string;
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
  costBreakdown?: any;
  categoryIds?: number[];
  characteristics?: Record<string, any>;
}

export interface UpdateProductDTO extends Partial<CreateProductDTO> {
  priceChangeReason?: string;
}

// DTO для расходов
>>>>>>> feature/edit-order
export interface CreateExpenseDTO {
  name: string;
  amount: number;
  category: string;
  description?: string;
  expense_date?: Date;
<<<<<<< HEAD
}
=======
}

// Отчеты
export interface SalesStats {
  totalRevenue: number;
  totalProfit: number;
  totalOrders: number;
  averageCheck: number;
  margin?: number;
}

export interface ProductProfitReport {
  productId: number;
  productName: string;
  quantity: number;
  revenue: number;
  cost: number;
  profit: number;
  margin: number;
  total_profit?: number;
}

// DTO для документов продаж
export interface CreateSaleDocumentDTO {
  clientId?: number;
  client?: {
    firstName: string;
    lastName: string;
    phone: string;
    city?: string;
  };
  items: Array<{
    productId: number;
    quantity: number;
    price: number;
    cost_price?: number;
  }>;
  discount?: number;
  discountPercent?: number;
  notes?: string;
  documentType?: 'receipt' | 'invoice';
  paymentStatus?: 'paid' | 'pending';
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  description?: string;
  paymentMethod?: string;
}

// DTO для продаж
export interface CreateSaleDTO {
  productId: number;
  quantity: number;
  selling_price: number;
  clientId?: number;
  customer_name?: string;
  customer_phone?: string;
}

export type MulterFile = Express.Multer.File;
>>>>>>> feature/edit-order
