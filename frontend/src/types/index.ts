// frontend/src/types/index.ts
export interface User {
  id: number;
  email: string;
  name: string;
  role: 'admin' | 'manager';
  createdAt: string;
  updatedAt: string;
}

export interface CategoryField {
  id: number;
  name: string;
  fieldType: 'text' | 'number' | 'select' | 'multiselect';
  isRequired: boolean;
  options?: string[] | string;
  sortOrder: number;
  categoryId: number;
}

export interface Category {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  sortOrder: number;
  fields?: CategoryField[];
  _count?: {
    products: number;
  };
  products?: Product[];
}

export interface ProductCharacteristic {
  [key: string]: string | number | string[];
}

export interface CostBreakdownItem {
  id?: string;
  name: string;
  amount: number;
  note?: string;
}

export interface Product {
  id: number;
  name: string;
  article: string;
  cost_price: number;
  retail_price: number;
  stock: number;
  min_stock: number;
  description?: string;
  categoryIds: number[];
  categories?: Category[];
  characteristics?: ProductCharacteristic;
  costBreakdown?: CostBreakdownItem[];
  createdAt: string;
  updatedAt: string;
}

export interface Client {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  birthDate?: string;
  city?: string;
  address?: string;
  carModel?: string;
  carYear?: string;
  carNumber?: string;
  carVin?: string;
  notes?: string;
  totalOrders?: number;
  totalSpent?: number;
  orders?: SaleDocument[];
  createdAt: string;
  updatedAt: string;
  discountPercent?: number;  // 🆕 Скидка клиента в %
}

export interface SaleDocumentItem {
  id: number;
  documentId: number;
  productId: number;
  productName: string;
  productArticle: string;
  quantity: number;
  price: number;
  total: number;
  cost_price?: number;
  cost_total?: number;
  isWork?: boolean;
}

export type OrderStatus = 'ordered' | 'assembling' | 'shipped';

export interface SaleDocument {
  id: number;
  documentNumber: string;
  documentType: 'order' | 'receipt' | 'invoice';
  clientId?: number;
  client?: Client;
  customerName?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerCity?: string;
  subtotal: number;
  discount: number;
  total: number;
  paymentMethod?: string;
  paymentStatus: 'paid' | 'unpaid';
  items: SaleDocumentItem[];
  saleDate: string;
  createdAt: string;
  updatedAt: string;
  description?: string;
  orderStatus?: OrderStatus;
  clientDiscount?: number;      // 🆕 Скидка клиента при создании заказа
  clientDiscountAmount?: number; // 🆕 Сумма скидки клиента
}

export interface Sale {
  id: number;
  productId: number;
  product?: Product;
  quantity: number;
  selling_price: number;
  total_cost: number;
  total_revenue: number;
  profit: number;
  customer_name?: string;
  customer_phone?: string;
  sale_date: string;
  documentId?: number;
}

export interface Expense {
  id: number;
  name: string;
  amount: number;
  category: string;
  date: string;
  description?: string;
}

export interface DashboardStats {
  totalRevenue: number;
  totalProfit: number;
  totalCost: number;
  margin: number;
  totalSales: number;
  totalProducts: number;
  lowStockCount: number;
  totalClients: number;
  totalStock: number;
  averageCheck: number;
  unpaidSales: number;
  unpaidTotal: number;
}

export interface ReportSummary {
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  totalCost: number;
  averageCheck: number;
  margin: number;
  unpaidCount: number;
  unpaidAmount: number;
}

export interface ProductStat {
  name: string;
  revenue: number;
  profit: number;
  quantity: number;
}

export interface ClientStat {
  name: string;
  phone?: string;
  city?: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface CityStat {
  name: string;
  revenue: number;
  profit: number;
  orders: number;
}

export interface AuditLog {
  id: number;
  userId: number;
  user: User;
  action: string;
  details: Record<string, unknown>;
  ip?: string;
  timestamp: string;
}

export interface AuthContextType {
  user: User | null;
  token: string | null;
  login: (email: string, password: string) => Promise<void>;
  logout: () => void;
  isAuthenticated: boolean;
  isAdmin: boolean;
}

export interface ThemeContextType {
  theme: 'light' | 'dark';
  toggleTheme: () => void;
}

export interface ApiResponse<T = unknown> {
  data: T;
  message?: string;
  error?: string;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

// Props for UI components
export interface ButtonProps {
  children: React.ReactNode;
  onClick?: () => void;
  type?: 'button' | 'submit' | 'reset';
  variant?: 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
  size?: 'sm' | 'md' | 'lg';
  fullWidth?: boolean;
  disabled?: boolean;
  loading?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  className?: string;
}

export interface InputProps {
  label?: string;
  type?: string;
  value: string | number;
  onChange: (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  icon?: React.ComponentType<{ size?: number; className?: string }>;
  multiline?: boolean;
  rows?: number;
  className?: string;
  min?: number;
  max?: number;
  step?: number;
}

export interface CardProps {
  children: React.ReactNode;
  className?: string;
}

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
}

export interface TableProps {
  children: React.ReactNode;
  className?: string;
}