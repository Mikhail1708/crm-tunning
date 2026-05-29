// frontend/src/api/reports.ts (строго типизированная версия)
import { api } from './client';
import type { 
  Product, 
  SaleDocument, 
  Expense, 
  ReportSummary,
  Client
} from '../types';

// Тип для дампа базы данных
export interface DatabaseDump {
  exportedAt: string;
  version: string;
  data: {
    users: Array<{
      id: number;
      email: string;
      name: string;
      role: string;
      password: string;
      createdAt: string;
      updatedAt: string;
    }>;
    products: Product[];
    categories: Array<{
      id: number;
      name: string;
      description: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    categoryFields: Array<{
      id: number;
      categoryId: number;
      name: string;
      fieldType: string;
      isRequired: boolean;
      options: string | null;
      createdAt: string;
      updatedAt: string;
    }>;
    productCharacteristics: Array<{
      id: number;
      productId: number;
      fieldId: number;
      value: string;
    }>;
    sales: Array<{
      id: number;
      productId: number;
      quantity: number;
      selling_price: number;
      total_cost: number;
      total_revenue: number;
      profit: number;
      customer_name: string | null;
      customer_phone: string | null;
      sale_date: string;
      documentId: number | null;
    }>;
    saleDocuments: SaleDocument[];
    saleDocumentItems: Array<{
      id: number;
      documentId: number;
      productId: number;
      productName: string;
      productArticle: string;
      quantity: number;
      price: number;
      total: number;
      cost_price: number;
    }>;
    expenses: Expense[];
    clients: Client[];
    productCategories?: Array<{ productId: number; categoryId: number }>;
  };
}

// Типы ответов API
interface SummaryResponse {
  total: { revenue: number; cost: number; profit: number; margin: number };
  products: { total: number; low_stock: number };
  clients: { total: number };
  top_products: Product[];
}

interface ProfitByProductResponse {
  id: number;
  name: string;
  article: string;
  cost_price: number;
  retail_price: number;
  stock: number;
  min_stock: number;
  total_sold: number;
  total_revenue: number;
  total_cost: number;
  total_profit: number;
  margin_percent: number;
  category: string;
}

interface ProfitChartResponse {
  period: string;
  revenue: number;
  cost: number;
  profit: number;
  sales_count: number;
}

interface OrdersByPeriodResponse {
  orders: SaleDocument[];
  stats: ReportSummary;
}

interface SalesStatsResponse {
  period: string;
  startDate: string;
  endDate: string;
  totalOrders: number;
  totalRevenue: number;
  totalProfit: number;
  averageCheck: number;
  margin: number;
}

interface ExpensesResponse {
  expenses: Expense[];
  summary: { total: number; by_category: Array<{ category: string; _sum: { amount: number } }> };
}

interface RestoreResponse {
  success: boolean;
  message: string;
  timestamp: string;
}

export const reportsApi = {
  getSummary: async (): Promise<SummaryResponse> => {
    const response = await api.get<SummaryResponse>('/reports/summary');
    return response.data;
  },

  getProfitByProduct: async (): Promise<ProfitByProductResponse[]> => {
    const response = await api.get<ProfitByProductResponse[]>('/reports/profit-by-product');
    return response.data;
  },

  getProfitChart: async (period?: string, limit?: number): Promise<ProfitChartResponse[]> => {
    const response = await api.get<ProfitChartResponse[]>('/reports/profit-chart', { params: { period, limit } });
    return response.data;
  },

  getOrdersByPeriod: async (startDate?: string, endDate?: string): Promise<OrdersByPeriodResponse> => {
    const response = await api.get<OrdersByPeriodResponse>('/reports/orders', { params: { startDate, endDate } });
    return response.data;
  },

  getSalesStats: async (period: string): Promise<SalesStatsResponse> => {
    const response = await api.get<SalesStatsResponse>(`/reports/stats/${period}`);
    return response.data;
  },

  getExpenses: async (startDate?: string, endDate?: string): Promise<ExpensesResponse> => {
    const response = await api.get<ExpensesResponse>('/reports/expenses', { params: { startDate, endDate } });
    return response.data;
  },

  createExpense: async (data: {
    name: string;
    amount: number;
    category: string;
    description?: string;
    expense_date?: string;
  }): Promise<Expense> => {
    const response = await api.post<Expense>('/reports/expenses', data);
    return response.data;
  },

  deleteAllSales: async (): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>('/reports/sales/all');
    return response.data;
  },

  getDatabaseDump: async (): Promise<DatabaseDump> => {
    const response = await api.get<DatabaseDump>('/reports/dump');
    return response.data;
  },

  restoreDatabase: async (dumpData: DatabaseDump): Promise<RestoreResponse> => {
    const response = await api.post<RestoreResponse>('/reports/restore', dumpData);
    return response.data;
  },

  clearDatabase: async (): Promise<{ message: string }> => {
    const response = await api.delete<{ message: string }>('/reports/database/clear');
    return response.data;
  },
};