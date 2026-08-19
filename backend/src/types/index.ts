import { Request } from 'express';

export interface RequestWithUser extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
    role: string;
  };
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
  fieldType: string;
  isRequired?: boolean;
  sortOrder?: number;
  options?: string;
}

// DTO для клиентов
export interface CreateClientDTO {
  firstName: string;
  lastName?: string;
  middleName?: string; // ✅ ОТЧЕСТВО
  phone: string;
  email?: string;
  city?: string;
  birthDate?: Date;
  address?: string;
  passport?: string;
  driverLicense?: string;
  carModel?: string;
  carYear?: number;
  carVin?: string;
  carNumber?: string;
  notes?: string;
  discountPercent?: number;
}

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
export interface CreateExpenseDTO {
  name: string;
  amount: number;
  category: string;
  description?: string;
  expense_date?: Date;
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
    middleName?: string; // ✅ ОТЧЕСТВО
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