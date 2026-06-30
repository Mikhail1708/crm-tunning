// frontend/src/pages/Reports.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { reportsApi } from '../api/reports';
import { saleDocumentsApi } from '../api/saleDocuments';
import { productsApi } from '../api/products';
import { clientsApi } from '../api/clients';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatPrice, formatDate } from '../utils/formatters';
import { SaleDocument, Product, Client, ReportSummary } from '../types';
import * as XLSX from 'xlsx';
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { 
  TrendingUp, 
  Loader,
  DollarSign,
  Package,
  PieChart as PieChartIcon,
  ShoppingBag,
  Receipt,
  Calendar,
  Users,
  MapPin,
  Search,
  Filter,
  BarChart3,
  LineChart as LineChartIcon,
  X,
  FileSpreadsheet,
  AlertCircle,
  Info,
  Calculator,
  Wrench,
  RefreshCw,
  ChevronDown,
  ChevronUp,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  SlidersHorizontal
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useDebounce } from '../hooks/useDebounce';

const COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec489a', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];

// ============================================================
// ТИПЫ
// ============================================================

interface DateFilter {
  type: 'day' | 'week' | 'month' | 'year' | 'custom';
  startDate?: string;
  endDate?: string;
}

interface AnalyticsFilters {
  date: DateFilter;
  productId: number | null;
  clientId: number | null;
  city: string | null;
  searchQuery: string;
}

interface ProductCostData {
  productId: number;
  productName: string;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  breakdown: { name: string; amount: number }[];
  salesCount: number;
  quantitySold: number;
}

interface FormattedSale extends SaleDocument {
  totalProfit: number;
  totalCost: number;
  customerCity: string;
}

interface ProductStat {
  name: string;
  revenue: number;
  profit: number;
  quantity: number;
  cost: number;
  productId?: number;
}

interface ClientStat {
  name: string;
  phone?: string;
  city?: string;
  revenue: number;
  profit: number;
  orders: number;
  clientId: number;
}

interface CityStat {
  name: string;
  revenue: number;
  profit: number;
  orders: number;
}

// ============================================================
// УНИВЕРСАЛЬНЫЙ ХУК ДЛЯ ФИЛЬТРАЦИИ ТАБЛИЦ
// ============================================================

type SortField = 'name' | 'quantity' | 'revenue' | 'cost' | 'profit' | 'margin' | 'orders' | 'city';
type SortDirection = 'asc' | 'desc';

interface TableFilterState<T> {
  searchQuery: string;
  filters: Record<string, { min: string; max: string }>;
  sortField: SortField;
  sortDirection: SortDirection;
  filteredData: T[];
}

function useTableFilter<T>(
  data: T[],
  searchFields: (keyof T)[],
  numericFields: (keyof T)[]
): {
  searchQuery: string;
  setSearchQuery: (value: string) => void;
  filters: Record<string, { min: string; max: string }>;
  setFilter: (field: string, type: 'min' | 'max', value: string) => void;
  clearFilters: () => void;
  sortField: SortField;
  setSortField: (field: SortField) => void;
  sortDirection: SortDirection;
  setSortDirection: (direction: SortDirection) => void;
  toggleSort: (field: SortField) => void;
  filteredData: T[];
  hasActiveFilters: boolean;
} {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [filters, setFilters] = useState<Record<string, { min: string; max: string }>>({});
  const [sortField, setSortField] = useState<SortField>('revenue');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const setFilter = useCallback((field: string, type: 'min' | 'max', value: string) => {
    setFilters(prev => ({
      ...prev,
      [field]: {
        ...prev[field],
        [type]: value
      }
    }));
  }, []);

  const clearFilters = useCallback(() => {
    setFilters({});
    setSearchQuery('');
  }, []);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  }, [sortField]);

  const filteredData = useMemo(() => {
    let result = [...data];

    // Поиск
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(item => {
        return searchFields.some(field => {
          const value = item[field];
          if (value === null || value === undefined) return false;
          return String(value).toLowerCase().includes(query);
        });
      });
    }

    // Фильтры по числовым полям
    Object.entries(filters).forEach(([field, range]) => {
      if (!range.min && !range.max) return;
      
      result = result.filter(item => {
        const value = item[field as keyof T];
        if (typeof value !== 'number') return true;
        
        if (range.min && value < Number(range.min)) return false;
        if (range.max && value > Number(range.max)) return false;
        return true;
      });
    });

    // Сортировка
    result.sort((a, b) => {
      let aVal: any = a[sortField as keyof T];
      let bVal: any = b[sortField as keyof T];

      // Для margin считаем отдельно
      if (sortField === 'margin') {
        const aMargin = (a as any).revenue > 0 ? ((a as any).profit / (a as any).revenue) * 100 : 0;
        const bMargin = (b as any).revenue > 0 ? ((b as any).profit / (b as any).revenue) * 100 : 0;
        aVal = aMargin;
        bVal = bMargin;
      }

      if (typeof aVal === 'string' && typeof bVal === 'string') {
        return sortDirection === 'asc' 
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      if (typeof aVal === 'number' && typeof bVal === 'number') {
        return sortDirection === 'asc' ? aVal - bVal : bVal - aVal;
      }

      return 0;
    });

    return result;
  }, [data, searchQuery, filters, sortField, sortDirection, searchFields]);

  const hasActiveFilters = useMemo(() => {
    return searchQuery !== '' || Object.values(filters).some(f => f.min || f.max);
  }, [searchQuery, filters]);

  return {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    sortField,
    setSortField,
    sortDirection,
    setSortDirection,
    toggleSort,
    filteredData,
    hasActiveFilters
  };
}

// ============================================================
// КОМПОНЕНТ: ChartWrapper
// ============================================================

const ChartWrapper: React.FC<{
  children: React.ReactNode;
  height?: number;
  className?: string;
}> = ({ children, height = 400, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const [dimensions, setDimensions] = useState({ width: 0, height: 0 });
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const updateDimensions = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        const w = rect.width || containerRef.current.offsetWidth || 800;
        const h = rect.height || containerRef.current.offsetHeight || height;
        
        if (w > 0 && h > 0) {
          setDimensions({ width: w, height: h });
          setIsReady(true);
        }
      }
    };

    updateDimensions();

    const resizeObserver = new ResizeObserver(() => {
      updateDimensions();
    });

    if (containerRef.current) {
      resizeObserver.observe(containerRef.current);
    }

    const timeoutId = setTimeout(updateDimensions, 100);
    const timeoutId2 = setTimeout(updateDimensions, 300);
    const timeoutId3 = setTimeout(updateDimensions, 600);

    return () => {
      resizeObserver.disconnect();
      clearTimeout(timeoutId);
      clearTimeout(timeoutId2);
      clearTimeout(timeoutId3);
    };
  }, [height]);

  if (!isReady || dimensions.width === 0 || dimensions.height === 0) {
    return (
      <div 
        ref={containerRef}
        className={`w-full ${className}`}
        style={{ 
          height: `${height}px`, 
          minHeight: `${height}px`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center'
        }}
      >
        <div className="flex items-center justify-center w-full h-full bg-gray-50 dark:bg-dark-800 rounded-lg animate-pulse">
          <Loader size={32} className="text-gray-400 animate-spin" />
          <span className="ml-3 text-gray-400 text-sm">Загрузка графика...</span>
        </div>
      </div>
    );
  }

  return (
    <div 
      ref={containerRef}
      className={`w-full ${className}`}
      style={{ 
        height: `${height}px`, 
        minHeight: `${height}px`,
        width: '100%'
      }}
    >
      <ResponsiveContainer width="100%" height="100%">
        {children}
      </ResponsiveContainer>
    </div>
  );
};

// ============================================================
// КОМПОНЕНТ: SortableTableHeader
// ============================================================

interface SortableTableHeaderProps {
  label: string;
  field: SortField;
  sortField: SortField;
  sortDirection: SortDirection;
  onSort: (field: SortField) => void;
  className?: string;
  filterable?: boolean;
  filterValue?: { min: string; max: string };
  onFilterChange?: (type: 'min' | 'max', value: string) => void;
}

const SortableTableHeader: React.FC<SortableTableHeaderProps> = ({
  label,
  field,
  sortField,
  sortDirection,
  onSort,
  className = '',
  filterable = false,
  filterValue = { min: '', max: '' },
  onFilterChange
}) => {
  const [showFilter, setShowFilter] = useState<boolean>(false);
  const isActive = sortField === field;

  return (
    <th className={`px-4 py-3 ${className}`}>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-1">
          <button
            onClick={() => onSort(field)}
            className="flex items-center gap-1 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase hover:text-gray-700 dark:hover:text-gray-300 transition-colors"
          >
            {label}
            {isActive ? (
              sortDirection === 'asc' ? (
                <ArrowUp size={12} className="text-primary-600" />
              ) : (
                <ArrowDown size={12} className="text-primary-600" />
              )
            ) : (
              <ArrowUpDown size={12} className="opacity-30" />
            )}
          </button>
          {filterable && onFilterChange && (
            <button
              onClick={() => setShowFilter(!showFilter)}
              className={`p-0.5 rounded hover:bg-gray-100 dark:hover:bg-dark-700 transition-colors ${
                (filterValue.min || filterValue.max) ? 'text-primary-600' : 'text-gray-400'
              }`}
              title="Фильтр"
            >
              <Filter size={12} />
            </button>
          )}
        </div>
        {showFilter && filterable && onFilterChange && (
          <div className="flex items-center gap-1">
            <input
              type="number"
              placeholder="от"
              value={filterValue.min}
              onChange={(e) => onFilterChange('min', e.target.value)}
              className="w-12 px-1 py-0.5 text-xs border rounded dark:bg-dark-800 dark:border-dark-700 dark:text-white"
            />
            <span className="text-xs text-gray-400">-</span>
            <input
              type="number"
              placeholder="до"
              value={filterValue.max}
              onChange={(e) => onFilterChange('max', e.target.value)}
              className="w-12 px-1 py-0.5 text-xs border rounded dark:bg-dark-800 dark:border-dark-700 dark:text-white"
            />
          </div>
        )}
      </div>
    </th>
  );
};

// ============================================================
// КОМПОНЕНТ: FilterBar (универсальный для таблиц)
// ============================================================

interface TableFilterBarProps {
  searchQuery: string;
  onSearchChange: (value: string) => void;
  hasActiveFilters: boolean;
  onClearFilters: () => void;
  placeholder?: string;
  children?: React.ReactNode;
}

const TableFilterBar: React.FC<TableFilterBarProps> = ({
  searchQuery,
  onSearchChange,
  hasActiveFilters,
  onClearFilters,
  placeholder = 'Поиск...',
  children
}) => {
  return (
    <div className="flex flex-wrap items-center gap-3 p-3 bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
      <div className="flex-1 min-w-[200px]">
        <div className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => onSearchChange(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg dark:bg-dark-900 dark:border-dark-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
      </div>
      {children}
      {hasActiveFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={onClearFilters}
          icon={X}
        >
          Сбросить фильтры
        </Button>
      )}
    </div>
  );
};

// ============================================================
// КОМПОНЕНТ: TableOrders (с фильтрацией)
// ============================================================

const TableOrders: React.FC<{ orders: FormattedSale[] }> = React.memo(({ orders }) => {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    sortField,
    toggleSort,
    filteredData,
    hasActiveFilters
  } = useTableFilter<FormattedSale>(
    orders,
    ['documentNumber', 'customerName', 'customerPhone', 'customerCity'],
    ['total', 'totalProfit', 'totalCost']
  );

  // Добавляем поле margin для сортировки
  const dataWithMargin = useMemo(() => {
    return filteredData.map(item => ({
      ...item,
      margin: item.total > 0 ? (item.totalProfit / item.total) * 100 : 0
    }));
  }, [filteredData]);

  if (orders.length === 0) {
    return (
      <div className="text-center py-12">
        <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">Нет оплаченных продаж за выбранный период</p>
      </div>
    );
  }

  return (
    <div>
      <TableFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        placeholder="Поиск по номеру, покупателю, городу..."
      />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
            <tr>
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Тип</th>
              <SortableTableHeader
                label="№ документа"
                field="documentNumber"
                sortField={sortField as any}
                sortDirection={'desc'}
                onSort={toggleSort as any}
              />
              <SortableTableHeader
                label="Дата"
                field="saleDate"
                sortField={sortField as any}
                sortDirection={'desc'}
                onSort={toggleSort as any}
              />
              <SortableTableHeader
                label="Покупатель"
                field="customerName"
                sortField={sortField as any}
                sortDirection={'desc'}
                onSort={toggleSort as any}
              />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Телефон</th>
              <SortableTableHeader
                label="Город"
                field="customerCity"
                sortField={sortField as any}
                sortDirection={'desc'}
                onSort={toggleSort as any}
              />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Состав</th>
              <SortableTableHeader
                label="Итого"
                field="total"
                sortField={sortField as any}
                sortDirection={'desc'}
                onSort={toggleSort as any}
                filterable
                filterValue={filters.total || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('total', type, value)}
              />
              <SortableTableHeader
                label="Прибыль"
                field="profit"
                sortField={sortField as any}
                sortDirection={'desc'}
                onSort={toggleSort as any}
                filterable
                filterValue={filters.profit || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('profit', type, value)}
              />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
            {dataWithMargin.map((order) => (
              <tr key={order.id} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                <td className="px-4 py-3 text-sm">
                  <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                    order.documentType === 'Чек' ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 
                    order.documentType === 'Счет' ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400' : 
                    'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                  }`}>
                    {order.documentType}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm font-mono text-primary-600 dark:text-primary-400">{order.documentNumber}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{formatDate(order.saleDate)}</td>
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{order.customerName || order.client?.firstName + ' ' + order.client?.lastName || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{order.customerPhone || order.client?.phone || '-'}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                  {order.customerCity && order.customerCity !== '-' ? (
                    <span className="flex items-center gap-1">
                      <MapPin size={12} className="text-gray-400" />
                      {order.customerCity}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-md truncate">
                  {order.items?.map(i => `${i.productName} x${i.quantity}`).join(', ') || '-'}
                </td>
                <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">{formatPrice(order.total)}</td>
                <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatPrice(order.totalProfit)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {dataWithMargin.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Нет данных, соответствующих фильтрам</p>
        </div>
      )}
    </div>
  );
});

TableOrders.displayName = 'TableOrders';

// ============================================================
// КОМПОНЕНТ: TableProductStats (с фильтрацией)
// ============================================================

const TableProductStats: React.FC<{ 
  productStats: ProductStat[]; 
  productsCostData: ProductCostData[];
  onProductClick: (product: ProductCostData) => void;
}> = React.memo(({ productStats, productsCostData, onProductClick }) => {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    sortField,
    toggleSort,
    filteredData,
    hasActiveFilters
  } = useTableFilter<ProductStat>(
    productStats,
    ['name'],
    ['quantity', 'revenue', 'cost', 'profit']
  );

  if (productStats.length === 0) {
    return (
      <div className="text-center py-12">
        <Package size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">Нет данных о товарах</p>
      </div>
    );
  }

  return (
    <div>
      <TableFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        placeholder="Поиск по названию товара..."
      />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
            <tr>
              <SortableTableHeader
                label="Товар"
                field="name"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
              />
              <SortableTableHeader
                label="Количество"
                field="quantity"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.quantity || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('quantity', type, value)}
              />
              <SortableTableHeader
                label="Выручка"
                field="revenue"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.revenue || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('revenue', type, value)}
              />
              <SortableTableHeader
                label="Себестоимость"
                field="cost"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.cost || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('cost', type, value)}
              />
              <SortableTableHeader
                label="Прибыль"
                field="profit"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.profit || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('profit', type, value)}
              />
              <SortableTableHeader
                label="Рентабельность"
                field="margin"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.margin || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('margin', type, value)}
              />
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Детали</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
            {filteredData.map((product, idx) => {
              const costData = productsCostData.find(p => p.productName === product.name);
              const margin = product.revenue > 0 ? (product.profit / product.revenue) * 100 : 0;
              
              return (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.name}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{product.quantity} шт.</td>
                  <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatPrice(product.revenue)}</td>
                  <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">{formatPrice(product.cost)}</td>
                  <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{formatPrice(product.profit)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      margin > 30 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 
                      margin > 10 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {costData && costData.breakdown.length > 0 && (
                      <button
                        onClick={() => onProductClick(costData)}
                        className="p-1 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                        title="Показать структуру себестоимости"
                      >
                        <Info size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Нет товаров, соответствующих фильтрам</p>
        </div>
      )}
    </div>
  );
});

TableProductStats.displayName = 'TableProductStats';

// ============================================================
// КОМПОНЕНТ: TableClientStats (с фильтрацией)
// ============================================================

const TableClientStats: React.FC<{ clientStats: ClientStat[] }> = React.memo(({ clientStats }) => {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    sortField,
    toggleSort,
    filteredData,
    hasActiveFilters
  } = useTableFilter<ClientStat>(
    clientStats,
    ['name', 'phone', 'city'],
    ['orders', 'revenue', 'profit']
  );

  if (clientStats.length === 0) {
    return (
      <div className="text-center py-12">
        <Users size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">Нет данных о клиентах</p>
      </div>
    );
  }

  return (
    <div>
      <TableFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        placeholder="Поиск по имени, телефону, городу..."
      />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
            <tr>
              <SortableTableHeader
                label="Клиент"
                field="name"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
              />
              <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Телефон</th>
              <SortableTableHeader
                label="Город"
                field="city"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
              />
              <SortableTableHeader
                label="Заказов"
                field="orders"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.orders || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('orders', type, value)}
              />
              <SortableTableHeader
                label="Выручка"
                field="revenue"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.revenue || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('revenue', type, value)}
              />
              <SortableTableHeader
                label="Прибыль"
                field="profit"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.profit || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('profit', type, value)}
              />
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ср. чек</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
            {filteredData.map((client, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">{client.name}</td>
                <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{client.phone || '-'}</td>
                <td className="px-4 py-3 text-sm">
                  {client.city && client.city !== '-' ? (
                    <span className="flex items-center gap-1 text-gray-700 dark:text-gray-300">
                      <MapPin size={12} className="text-gray-400" />
                      {client.city}
                    </span>
                  ) : (
                    <span className="text-gray-400">-</span>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{client.orders}</td>
                <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatPrice(client.revenue)}</td>
                <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{formatPrice(client.profit)}</td>
                <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">{formatPrice(client.revenue / client.orders)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Нет клиентов, соответствующих фильтрам</p>
        </div>
      )}
    </div>
  );
});

TableClientStats.displayName = 'TableClientStats';

// ============================================================
// КОМПОНЕНТ: CityStats (с фильтрацией)
// ============================================================

const CityStats: React.FC<{ cityStats: CityStat[]; totalRevenue: number }> = React.memo(({ cityStats, totalRevenue }) => {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    sortField,
    toggleSort,
    filteredData,
    hasActiveFilters
  } = useTableFilter<CityStat>(
    cityStats,
    ['name'],
    ['orders', 'revenue', 'profit']
  );

  if (cityStats.length === 0) {
    return (
      <div className="text-center py-12">
        <MapPin size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">Нет данных о городах</p>
      </div>
    );
  }

  const filteredCities = filteredData.filter(c => c.name !== 'Не указан');

  return (
    <div>
      <TableFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        placeholder="Поиск по городу..."
      />
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 border-b border-gray-200 dark:border-dark-700">
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Выручка по городам</h3>
          {filteredCities.length > 0 ? (
            <ChartWrapper height={400}>
              <PieChart margin={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                <Pie
                  data={filteredCities.slice(0, 8)}
                  dataKey="revenue"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={120}
                  label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  labelLine={true}
                >
                  {filteredCities.slice(0, 8).map((_, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(value) => formatPrice(value as number)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '12px' }} />
              </PieChart>
            </ChartWrapper>
          ) : (
            <div className="h-400 flex items-center justify-center text-gray-500">
              Нет данных о городах
            </div>
          )}
        </div>
        <div>
          <h3 className="font-medium text-gray-900 dark:text-white mb-4">Количество заказов по городам</h3>
          <ChartWrapper height={400}>
            <BarChart data={filteredCities.slice(0, 10)} margin={{ bottom: 60 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
              <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} stroke="#9ca3af" interval={0} tick={{ fontSize: 11 }} />
              <YAxis stroke="#9ca3af" />
              <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
              <Bar dataKey="orders" fill="#10b981" name="Заказов" />
            </BarChart>
          </ChartWrapper>
        </div>
      </div>
      
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
            <tr>
              <SortableTableHeader
                label="Город"
                field="name"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
              />
              <SortableTableHeader
                label="Заказов"
                field="orders"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.orders || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('orders', type, value)}
              />
              <SortableTableHeader
                label="Выручка"
                field="revenue"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.revenue || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('revenue', type, value)}
              />
              <SortableTableHeader
                label="Прибыль"
                field="profit"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.profit || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('profit', type, value)}
              />
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ср. чек</th>
              <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Доля</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
            {filteredData.map((city, idx) => (
              <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white flex items-center gap-2">
                  <MapPin size={14} className="text-gray-400" />
                  {city.name}
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{city.orders}</td>
                <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatPrice(city.revenue)}</td>
                <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{formatPrice(city.profit)}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{formatPrice(city.revenue / city.orders)}</td>
                <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                  {totalRevenue > 0 ? ((city.revenue / totalRevenue) * 100).toFixed(1) : 0}%
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Нет городов, соответствующих фильтрам</p>
        </div>
      )}
    </div>
  );
});

CityStats.displayName = 'CityStats';

// ============================================================
// КОМПОНЕНТ: TableCostData (с фильтрацией)
// ============================================================

const TableCostData: React.FC<{ 
  productsCostData: ProductCostData[];
  onProductClick: (product: ProductCostData) => void;
}> = React.memo(({ productsCostData, onProductClick }) => {
  const {
    searchQuery,
    setSearchQuery,
    filters,
    setFilter,
    clearFilters,
    sortField,
    toggleSort,
    filteredData,
    hasActiveFilters
  } = useTableFilter<ProductCostData>(
    productsCostData,
    ['productName'],
    ['quantitySold', 'totalRevenue', 'totalCost', 'totalProfit']
  );

  if (productsCostData.length === 0) {
    return (
      <div className="text-center py-12">
        <Calculator size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
        <p className="text-gray-500 dark:text-gray-400">Нет данных о себестоимости</p>
      </div>
    );
  }

  return (
    <div>
      <TableFilterBar
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        hasActiveFilters={hasActiveFilters}
        onClearFilters={clearFilters}
        placeholder="Поиск по названию товара..."
      />
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
            <tr>
              <SortableTableHeader
                label="Товар"
                field="name"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
              />
              <SortableTableHeader
                label="Продано"
                field="quantity"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.quantity || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('quantity', type, value)}
              />
              <SortableTableHeader
                label="Выручка"
                field="revenue"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.revenue || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('revenue', type, value)}
              />
              <SortableTableHeader
                label="Себестоимость"
                field="cost"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.cost || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('cost', type, value)}
              />
              <SortableTableHeader
                label="Прибыль"
                field="profit"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.profit || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('profit', type, value)}
              />
              <SortableTableHeader
                label="Маржинальность"
                field="margin"
                sortField={sortField}
                sortDirection={'desc'}
                onSort={toggleSort}
                filterable
                filterValue={filters.margin || { min: '', max: '' }}
                onFilterChange={(type, value) => setFilter('margin', type, value)}
              />
              <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Состав</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
            {filteredData.map((product, idx) => {
              const margin = product.totalRevenue > 0 ? (product.totalProfit / product.totalRevenue) * 100 : 0;
              
              return (
                <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                  <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.productName}</td>
                  <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{product.quantitySold} шт.</td>
                  <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatPrice(product.totalRevenue)}</td>
                  <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">{formatPrice(product.totalCost)}</td>
                  <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{formatPrice(product.totalProfit)}</td>
                  <td className="px-4 py-3 text-sm text-right">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      margin > 30 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 
                      margin > 10 ? 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400' :
                      'bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-400'
                    }`}>
                      {margin.toFixed(1)}%
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm text-center">
                    {product.breakdown.length > 0 && (
                      <button
                        onClick={() => onProductClick(product)}
                        className="p-1 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                        title="Показать структуру себестоимости"
                      >
                        <Info size={18} />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {filteredData.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <p>Нет товаров, соответствующих фильтрам</p>
        </div>
      )}
    </div>
  );
});

TableCostData.displayName = 'TableCostData';

// ============================================================
// КОМПОНЕНТ: CostChart
// ============================================================

const CostChart: React.FC<{ productsCostData: ProductCostData[] }> = React.memo(({ productsCostData }) => {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  
  const topByCost = useMemo(() => 
    [...productsCostData]
      .sort((a, b) => b.totalCost - a.totalCost)
      .slice(0, 10),
    [productsCostData]
  );

  const pieData = useMemo(() => 
    productsCostData
      .filter(p => p.totalCost > 0)
      .map((p, idx) => ({
        name: p.productName.length > 25 ? p.productName.slice(0, 22) + '...' : p.productName,
        value: p.totalCost,
        color: COLORS[idx % COLORS.length]
      })),
    [productsCostData]
  );

  if (productsCostData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Calculator size={48} className="mx-auto mb-3 opacity-50" />
        <p>Нет данных о себестоимости</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-900 dark:text-white">Общая себестоимость проданных товаров</h3>
        <div className="flex gap-2">
          <Button variant={chartType === 'bar' ? 'primary' : 'secondary'} size="sm" onClick={() => setChartType('bar')}>
            Столбцы
          </Button>
          <Button variant={chartType === 'pie' ? 'primary' : 'secondary'} size="sm" onClick={() => setChartType('pie')}>
            Круговая
          </Button>
        </div>
      </div>
      <ChartWrapper height={380}>
        {chartType === 'bar' ? (
          <BarChart data={topByCost} layout="vertical" margin={{ left: 140, right: 20, top: 20, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" tickFormatter={(value) => formatPrice(value)} />
            <YAxis type="category" dataKey="productName" width={140} tick={{ fontSize: 11 }} interval={0} />
            <Tooltip formatter={(value) => formatPrice(value as number)} />
            <Bar dataKey="totalCost" fill="#f59e0b" name="Себестоимость" />
          </BarChart>
        ) : (
          <PieChart margin={{ top: 20, bottom: 20, left: 20, right: 20 }}>
            <Pie
              data={pieData.slice(0, 10)}
              dataKey="value"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              labelLine={true}
            >
              {pieData.slice(0, 10).map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatPrice(value as number)} />
            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '12px' }} />
          </PieChart>
        )}
      </ChartWrapper>
    </div>
  );
});

CostChart.displayName = 'CostChart';

// ============================================================
// КОМПОНЕНТ: WorkTypeCostChart
// ============================================================

const WorkTypeCostChart: React.FC<{ workTypeData: { name: string; amount: number }[] }> = React.memo(({ workTypeData }) => {
  if (workTypeData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Wrench size={48} className="mx-auto mb-3 opacity-50" />
        <p>Нет данных о затратах по видам работ</p>
      </div>
    );
  }

  const shortNamesData = useMemo(() => 
    workTypeData.map(item => ({
      ...item,
      name: item.name.length > 20 ? item.name.slice(0, 17) + '...' : item.name
    })),
    [workTypeData]
  );

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <Wrench size={16} className="text-primary-600" />
        Затраты по видам работ (все товары)
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ChartWrapper height={380}>
          <PieChart>
            <Pie
              data={shortNamesData}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={110}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              labelLine={true}
            >
              {shortNamesData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatPrice(value as number)} />
            <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '11px' }} />
          </PieChart>
        </ChartWrapper>
        <div className="space-y-2 overflow-y-auto max-h-96">
          {workTypeData.map((item, idx) => (
            <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-dark-800 rounded-lg">
              <div className="flex items-center gap-2">
                <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
              </div>
              <div className="text-right">
                <span className="text-sm font-medium text-gray-900 dark:text-white">{formatPrice(item.amount)}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
});

WorkTypeCostChart.displayName = 'WorkTypeCostChart';

// ============================================================
// КОМПОНЕНТ: FilterBar (основной)
// ============================================================

interface FilterBarProps {
  filters: AnalyticsFilters;
  onFilterChange: <K extends keyof AnalyticsFilters>(key: K, value: AnalyticsFilters[K]) => void;
  onReset: () => void;
  onApply: () => void;
  loading: boolean;
  products: Product[];
  clients: Client[];
}

const FilterBar: React.FC<FilterBarProps> = React.memo(({
  filters,
  onFilterChange,
  onReset,
  onApply,
  loading,
  products,
  clients
}) => {
  const [isExpanded, setIsExpanded] = useState<boolean>(false);
  const [productSearch, setProductSearch] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  
  const productRef = useRef<HTMLDivElement>(null);
  const clientRef = useRef<HTMLDivElement>(null);

  const selectedProduct = useMemo(() => {
    if (!filters.productId) return null;
    return products.find(p => p.id === filters.productId) || null;
  }, [filters.productId, products]);

  const selectedClient = useMemo(() => {
    if (!filters.clientId) return null;
    return clients.find(c => c.id === filters.clientId) || null;
  }, [filters.clientId, clients]);

  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products.slice(0, 20);
    const search = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(search) ||
      p.article?.toLowerCase().includes(search)
    ).slice(0, 20);
  }, [products, productSearch]);

  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients.slice(0, 20);
    const search = clientSearch.toLowerCase();
    return clients.filter(c => {
      const name = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ').toLowerCase();
      return name.includes(search) || c.phone.includes(search) || (c.city || '').toLowerCase().includes(search);
    }).slice(0, 20);
  }, [clients, clientSearch]);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (productRef.current && !productRef.current.contains(e.target as Node)) {
        setShowProductDropdown(false);
      }
      if (clientRef.current && !clientRef.current.contains(e.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleProductSelect = (product: Product) => {
    onFilterChange('productId', product.id);
    setProductSearch(product.name);
    setShowProductDropdown(false);
  };

  const handleClientSelect = (client: Client) => {
    onFilterChange('clientId', client.id);
    const name = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
    setClientSearch(name);
    setShowClientDropdown(false);
  };

  const clearProduct = () => {
    onFilterChange('productId', null);
    setProductSearch('');
  };

  const clearClient = () => {
    onFilterChange('clientId', null);
    setClientSearch('');
  };

  const clearCity = () => {
    onFilterChange('city', null);
  };

  const handlePeriodChange = (type: DateFilter['type']) => {
    onFilterChange('date', { type });
  };

  const getPeriodLabel = (type: DateFilter['type']): string => {
    switch (type) {
      case 'day': return 'Сегодня';
      case 'week': return 'Неделя';
      case 'month': return 'Месяц';
      case 'year': return 'Год';
      case 'custom': {
        if (filters.date.startDate && filters.date.endDate) {
          return `${filters.date.startDate} — ${filters.date.endDate}`;
        }
        return 'Произвольный';
      }
      default: return 'Все время';
    }
  };

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700">
      <div className="p-4">
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-1 bg-gray-50 dark:bg-dark-900 rounded-lg p-1">
            <Button variant={filters.date.type === 'day' ? 'primary' : 'ghost'} size="sm" onClick={() => handlePeriodChange('day')}>
              День
            </Button>
            <Button variant={filters.date.type === 'week' ? 'primary' : 'ghost'} size="sm" onClick={() => handlePeriodChange('week')}>
              Неделя
            </Button>
            <Button variant={filters.date.type === 'month' ? 'primary' : 'ghost'} size="sm" onClick={() => handlePeriodChange('month')}>
              Месяц
            </Button>
            <Button variant={filters.date.type === 'year' ? 'primary' : 'ghost'} size="sm" onClick={() => handlePeriodChange('year')}>
              Год
            </Button>
            <Button variant={filters.date.type === 'custom' ? 'primary' : 'ghost'} size="sm" onClick={() => handlePeriodChange('custom')}>
              <Calendar size={14} className="mr-1" />
              Свой
            </Button>
          </div>

          {filters.date.type === 'custom' && (
            <div className="flex items-center gap-2 bg-gray-50 dark:bg-dark-900 rounded-lg p-1">
              <input
                type="date"
                value={filters.date.startDate || ''}
                onChange={(e) => onFilterChange('date', { ...filters.date, startDate: e.target.value })}
                className="px-2 py-1 text-sm border rounded dark:bg-dark-800 dark:border-dark-700 dark:text-white"
              />
              <span className="text-gray-400">→</span>
              <input
                type="date"
                value={filters.date.endDate || ''}
                onChange={(e) => onFilterChange('date', { ...filters.date, endDate: e.target.value })}
                className="px-2 py-1 text-sm border rounded dark:bg-dark-800 dark:border-dark-700 dark:text-white"
              />
            </div>
          )}

          <div className="flex-1 min-w-[200px]">
            <div className="relative">
              <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={filters.searchQuery}
                onChange={(e) => onFilterChange('searchQuery', e.target.value)}
                placeholder="Поиск по названию, артикулу..."
                className="w-full pl-9 pr-3 py-1.5 text-sm border rounded-lg dark:bg-dark-900 dark:border-dark-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          </div>

          <Button onClick={onApply} disabled={loading} variant="primary" size="sm" icon={RefreshCw}>
            {loading ? 'Загрузка...' : 'Применить'}
          </Button>

          <Button onClick={onReset} variant="ghost" size="sm" icon={X}>
            Сброс
          </Button>

          <Button variant="ghost" size="sm" onClick={() => setIsExpanded(!isExpanded)} icon={isExpanded ? ChevronUp : ChevronDown}>
            {isExpanded ? 'Скрыть' : 'Дополнительно'}
          </Button>
        </div>

        <div className="flex flex-wrap gap-2 mt-3">
          {filters.date.type && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 rounded-full">
              <Calendar size={12} />
              {getPeriodLabel(filters.date.type)}
            </span>
          )}
          {selectedProduct && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-50 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 rounded-full">
              <Package size={12} />
              {selectedProduct.name}
              <button onClick={clearProduct} className="hover:bg-blue-100 dark:hover:bg-blue-800 rounded-full p-0.5">
                <X size={12} />
              </button>
            </span>
          )}
          {selectedClient && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-50 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 rounded-full">
              <Users size={12} />
              {[selectedClient.lastName, selectedClient.firstName].filter(Boolean).join(' ')}
              <button onClick={clearClient} className="hover:bg-purple-100 dark:hover:bg-purple-800 rounded-full p-0.5">
                <X size={12} />
              </button>
            </span>
          )}
          {filters.city && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-green-50 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full">
              <MapPin size={12} />
              {filters.city}
              <button onClick={clearCity} className="hover:bg-green-100 dark:hover:bg-green-800 rounded-full p-0.5">
                <X size={12} />
              </button>
            </span>
          )}
          {filters.searchQuery && (
            <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 rounded-full">
              <Search size={12} />
              {filters.searchQuery}
            </span>
          )}
        </div>
      </div>

      {isExpanded && (
        <div className="border-t border-gray-200 dark:border-dark-700 p-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div ref={productRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Товар</label>
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={productSearch}
                  onChange={(e) => {
                    setProductSearch(e.target.value);
                    setShowProductDropdown(true);
                  }}
                  onFocus={() => setShowProductDropdown(true)}
                  placeholder="Поиск товара..."
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-dark-900 dark:border-dark-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {showProductDropdown && filteredProducts.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-dark-800 border dark:border-dark-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredProducts.map(p => (
                    <div
                      key={p.id}
                      className="p-2 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer border-b last:border-0 text-sm"
                      onClick={() => handleProductSelect(p)}
                    >
                      <div className="font-medium text-gray-900 dark:text-white">{p.name}</div>
                      <div className="text-xs text-gray-500 dark:text-gray-400">Арт: {p.article}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div ref={clientRef} className="relative">
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Клиент</label>
              <div className="relative">
                <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={clientSearch}
                  onChange={(e) => {
                    setClientSearch(e.target.value);
                    setShowClientDropdown(true);
                  }}
                  onFocus={() => setShowClientDropdown(true)}
                  placeholder="Поиск клиента..."
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-dark-900 dark:border-dark-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
              {showClientDropdown && filteredClients.length > 0 && (
                <div className="absolute z-20 w-full mt-1 bg-white dark:bg-dark-800 border dark:border-dark-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                  {filteredClients.map(c => {
                    const name = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ') || c.firstName;
                    return (
                      <div
                        key={c.id}
                        className="p-2 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer border-b last:border-0 text-sm"
                        onClick={() => handleClientSelect(c)}
                      >
                        <div className="font-medium text-gray-900 dark:text-white">{name}</div>
                        <div className="text-xs text-gray-500 dark:text-gray-400">📞 {c.phone}</div>
                        {c.city && <div className="text-xs text-gray-400">🏙️ {c.city}</div>}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Город</label>
              <div className="relative">
                <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
                <input
                  type="text"
                  value={filters.city || ''}
                  onChange={(e) => onFilterChange('city', e.target.value || null)}
                  placeholder="Введите город..."
                  className="w-full pl-9 pr-3 py-2 text-sm border rounded-lg dark:bg-dark-900 dark:border-dark-700 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});

FilterBar.displayName = 'FilterBar';

// ============================================================
// КОМПОНЕНТ: ProductCostModal
// ============================================================

const ProductCostModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  product: ProductCostData | null;
}> = ({ isOpen, onClose, product }) => {
  if (!product) return null;

  const pieData = product.breakdown.map((item, idx) => ({
    name: item.name,
    value: item.amount,
    color: COLORS[idx % COLORS.length]
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Себестоимость: ${product.productName}`} size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Продано</p>
            <p className="text-xl font-bold text-gray-900 dark:text-white">{product.quantitySold} шт.</p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Выручка</p>
            <p className="text-xl font-bold text-green-600">{formatPrice(product.totalRevenue)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Себестоимость</p>
            <p className="text-xl font-bold text-orange-600">{formatPrice(product.totalCost)}</p>
          </div>
          <div className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-center">
            <p className="text-xs text-gray-500 dark:text-gray-400">Прибыль</p>
            <p className="text-xl font-bold text-purple-600">{formatPrice(product.totalProfit)}</p>
          </div>
        </div>

        {pieData.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calculator size={16} className="text-primary-600" />
              Структура себестоимости
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <ChartWrapper height={320}>
                <PieChart>
                  <Pie
                    data={pieData}
                    dataKey="value"
                    nameKey="name"
                    cx="50%"
                    cy="50%"
                    outerRadius={90}
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    labelLine={true}
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => formatPrice(value as number)} />
                </PieChart>
              </ChartWrapper>
              <div className="space-y-2 overflow-y-auto max-h-80">
                {product.breakdown.map((item, idx) => (
                  <div key={idx} className="flex justify-between items-center p-2 bg-gray-50 dark:bg-dark-800 rounded-lg">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
                      <span className="text-sm text-gray-700 dark:text-gray-300">{item.name}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-gray-900 dark:text-white">{formatPrice(item.amount)}</span>
                      <span className="text-xs text-gray-500 ml-2">
                        ({product.totalCost > 0 ? ((item.amount / product.totalCost) * 100).toFixed(1) : 0}%)
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ============================================================
// ГЛАВНЫЙ КОМПОНЕНТ: Reports
// ============================================================

export const Reports: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [orders, setOrders] = useState<FormattedSale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  
  const [stats, setStats] = useState<ReportSummary>({
    totalOrders: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalCost: 0,
    averageCheck: 0,
    margin: 0,
    unpaidCount: 0,
    unpaidAmount: 0
  });

  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'clients' | 'cities' | 'cost'>('overview');
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  
  const [filters, setFilters] = useState<AnalyticsFilters>({
    date: { type: 'month' },
    productId: null,
    clientId: null,
    city: null,
    searchQuery: ''
  });

  const [selectedProductCost, setSelectedProductCost] = useState<ProductCostData | null>(null);
  const [isCostModalOpen, setIsCostModalOpen] = useState<boolean>(false);

  const debouncedSearch = useDebounce(filters.searchQuery, 500);

  // Загрузка справочников
  const loadReferenceData = useCallback(async () => {
    try {
      const [productsRes, clientsRes, allProductsRes] = await Promise.all([
        productsApi.getAll(),
        clientsApi.getAll({ limit: 1000 }),
        productsApi.getAll()
      ]);
      
      let clientsData: Client[] = [];
      if (clientsRes.data) {
        if (Array.isArray(clientsRes.data)) {
          clientsData = clientsRes.data;
        } else if (clientsRes.data.data && Array.isArray(clientsRes.data.data)) {
          clientsData = clientsRes.data.data;
        } else if (clientsRes.data.clients && Array.isArray(clientsRes.data.clients)) {
          clientsData = clientsRes.data.clients;
        }
      }
      
      setProducts(productsRes.data || []);
      setClients(clientsData);
      setAllProducts(allProductsRes.data || []);
    } catch (error) {
      console.error('Error loading reference data:', error);
      toast.error('Ошибка загрузки справочников');
    }
  }, []);

  // Загрузка заказов
  const loadOrders = useCallback(async () => {
    setLoading(true);
    try {
      const response = await saleDocumentsApi.getAll();
      let allDocuments = response.data || [];
      let paidDocuments = allDocuments.filter(doc => doc.paymentStatus === 'paid');
      
      let filteredSales = [...paidDocuments];
      
      // Фильтр по дате
      if (filters.date.type !== 'custom') {
        let startDateFilter: Date | null = null;
        const now = new Date();
        switch (filters.date.type) {
          case 'day':
            startDateFilter = new Date(now);
            startDateFilter.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDateFilter = new Date(now);
            startDateFilter.setDate(now.getDate() - 7);
            break;
          case 'month':
            startDateFilter = new Date(now);
            startDateFilter.setMonth(now.getMonth() - 1);
            break;
          case 'year':
            startDateFilter = new Date(now);
            startDateFilter.setFullYear(now.getFullYear() - 1);
            break;
          default:
            break;
        }
        if (startDateFilter) {
          filteredSales = paidDocuments.filter(sale => new Date(sale.saleDate) >= startDateFilter!);
        }
      } else if (filters.date.startDate && filters.date.endDate) {
        const start = new Date(filters.date.startDate);
        const end = new Date(filters.date.endDate);
        end.setHours(23, 59, 59, 999);
        filteredSales = paidDocuments.filter(sale => {
          const saleDate = new Date(sale.saleDate);
          return saleDate >= start && saleDate <= end;
        });
      }
      
      // Фильтр по товару
      if (filters.productId) {
        filteredSales = filteredSales.filter(sale => 
          sale.items?.some(item => item.productId === filters.productId)
        );
      }
      
      // Фильтр по клиенту
      if (filters.clientId) {
        filteredSales = filteredSales.filter(sale => 
          sale.clientId === filters.clientId
        );
      }
      
      // Фильтр по городу
      if (filters.city) {
        const cityLower = filters.city.toLowerCase();
        filteredSales = filteredSales.filter(sale => {
          const clientCity = sale.client?.city || '';
          return clientCity.toLowerCase().includes(cityLower);
        });
      }
      
      // Фильтр по поиску
      if (debouncedSearch) {
        const searchLower = debouncedSearch.toLowerCase();
        filteredSales = filteredSales.filter(sale => {
          if (sale.documentNumber?.toLowerCase().includes(searchLower)) return true;
          if (sale.customerName?.toLowerCase().includes(searchLower)) return true;
          if (sale.customerPhone?.includes(searchLower)) return true;
          if (sale.items?.some(item => item.productName.toLowerCase().includes(searchLower))) return true;
          if (sale.items?.some(item => item.productArticle?.toLowerCase().includes(searchLower))) return true;
          return false;
        });
      }
      
      // Форматирование
      const formattedSales: FormattedSale[] = filteredSales.map(sale => {
        const itemsWithCost = (sale.items || []).map(item => {
          const costPrice = item.cost_price || 0;
          return {
            name: item.productName || 'Товар',
            article: item.productArticle || '-',
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            cost_price: costPrice,
            cost_total: costPrice * item.quantity,
            productId: item.productId
          };
        });
        
        const totalCost = itemsWithCost.reduce((sum, item) => sum + item.cost_total, 0);
        const totalProfit = sale.total - totalCost;
        
        const docType = sale.documentType === 'receipt' ? 'Чек' : 
                       sale.documentType === 'invoice' ? 'Счет' : 'Заказ';
        
        let city = '-';
        if (sale.client?.city && sale.client.city.trim() !== '') {
          city = sale.client.city;
        } else if ((sale as any).customerCity) {
          city = (sale as any).customerCity;
        }
        
        return {
          ...sale,
          documentType: docType,
          totalProfit,
          totalCost,
          customerCity: city
        };
      });
      
      setOrders(formattedSales);
      
      const totalOrders = formattedSales.length;
      const totalRevenue = formattedSales.reduce((sum, o) => sum + o.total, 0);
      const totalCost = formattedSales.reduce((sum, o) => sum + o.totalCost, 0);
      const totalProfit = totalRevenue - totalCost;
      const averageCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      
      const unpaidDocuments = allDocuments.filter(doc => doc.paymentStatus !== 'paid');
      const unpaidAmount = unpaidDocuments.reduce((sum, d) => sum + (d.total || 0), 0);
      
      setStats({
        totalOrders,
        totalRevenue,
        totalProfit,
        totalCost,
        averageCheck,
        margin,
        unpaidCount: unpaidDocuments.length,
        unpaidAmount
      });
      
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Ошибка загрузки отчетов');
    } finally {
      setLoading(false);
    }
  }, [filters, debouncedSearch]);

  useEffect(() => {
    loadReferenceData();
  }, [loadReferenceData]);

  useEffect(() => {
    loadOrders();
  }, [loadOrders]);

  const handleFilterChange = <K extends keyof AnalyticsFilters>(
    key: K,
    value: AnalyticsFilters[K]
  ) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const handleApplyFilters = () => {
    loadOrders();
  };

  const handleResetFilters = () => {
    setFilters({
      date: { type: 'month' },
      productId: null,
      clientId: null,
      city: null,
      searchQuery: ''
    });
    setTimeout(() => loadOrders(), 50);
  };

  // Вычисляемые данные
  const productsCostData = useMemo((): ProductCostData[] => {
    const productMap = new Map<number, ProductCostData>();
    
    orders.forEach(order => {
      order.items?.forEach(item => {
        const productId = item.productId;
        const product = allProducts.find(p => p.id === productId);
        
        if (!productMap.has(productId)) {
          productMap.set(productId, {
            productId,
            productName: item.productName || product?.name || 'Неизвестный товар',
            totalCost: 0,
            totalRevenue: 0,
            totalProfit: 0,
            breakdown: [],
            salesCount: 0,
            quantitySold: 0
          });
        }
        
        const data = productMap.get(productId)!;
        const itemCost = (item.cost_price || 0) * item.quantity;
        const itemRevenue = item.total || 0;
        
        data.totalCost += itemCost;
        data.totalRevenue += itemRevenue;
        data.totalProfit += itemRevenue - itemCost;
        data.salesCount += 1;
        data.quantitySold += item.quantity;
        
        if (product?.costBreakdown && product.costBreakdown.length > 0 && product.cost_price > 0) {
          product.costBreakdown.forEach((breakItem: { name: string; amount: number }) => {
            const existingBreak = data.breakdown.find(b => b.name === breakItem.name);
            const scaledAmount = (breakItem.amount / product.cost_price) * itemCost;
            
            if (existingBreak) {
              existingBreak.amount += scaledAmount;
            } else {
              data.breakdown.push({
                name: breakItem.name,
                amount: scaledAmount
              });
            }
          });
        }
      });
    });
    
    return Array.from(productMap.values());
  }, [orders, allProducts]);

  const workTypeData = useMemo(() => {
    const workMap = new Map<string, number>();
    productsCostData.forEach(product => {
      product.breakdown.forEach(breakItem => {
        workMap.set(breakItem.name, (workMap.get(breakItem.name) || 0) + breakItem.amount);
      });
    });
    return Array.from(workMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [productsCostData]);

  const chartData = useMemo(() => {
    const grouped: Record<string, { date: string; dateObj: Date; revenue: number; profit: number; cost: number; orders: number }> = {};
    orders.forEach(order => {
      const date = new Date(order.saleDate);
      const formattedDate = date.toLocaleDateString('ru-RU');
      if (!grouped[formattedDate]) {
        grouped[formattedDate] = { 
          date: formattedDate, 
          dateObj: date,
          revenue: 0, 
          profit: 0, 
          cost: 0, 
          orders: 0 
        };
      }
      grouped[formattedDate].revenue += order.total || 0;
      grouped[formattedDate].profit += order.totalProfit || 0;
      grouped[formattedDate].cost += order.totalCost || 0;
      grouped[formattedDate].orders += 1;
    });
    return Object.values(grouped).sort((a, b) => a.dateObj.getTime() - b.dateObj.getTime());
  }, [orders]);

  const productStats = useMemo(() => {
    const productMap = new Map<string, { name: string; revenue: number; profit: number; quantity: number; cost: number; productId?: number }>();
    orders.forEach(order => {
      order.items?.forEach(item => {
        const key = item.productId?.toString() || item.productName;
        if (!productMap.has(key)) {
          productMap.set(key, { 
            name: item.productName, 
            revenue: 0, 
            profit: 0, 
            quantity: 0,
            cost: 0,
            productId: item.productId
          });
        }
        const p = productMap.get(key)!;
        p.revenue += item.total;
        p.profit += (item.price - item.cost_price) * item.quantity;
        p.quantity += item.quantity;
        p.cost += (item.cost_price || 0) * item.quantity;
      });
    });
    return Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const clientStats = useMemo(() => {
    const clientMap = new Map<number, { name: string; phone?: string; city?: string; revenue: number; profit: number; orders: number; clientId: number }>();
    
    orders.forEach(order => {
      const clientId = order.clientId;
      if (!clientId) return;
      
      const client = clients.find(c => c.id === clientId);
      if (!client) return;
      
      const fullName = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ').trim() || client.firstName || 'Клиент';
      
      if (!clientMap.has(clientId)) {
        clientMap.set(clientId, {
          name: fullName,
          phone: client.phone,
          city: client.city || '-',
          revenue: 0,
          profit: 0,
          orders: 0,
          clientId
        });
      }
      
      const c = clientMap.get(clientId)!;
      c.revenue += order.total;
      c.profit += order.totalProfit;
      c.orders += 1;
    });
    
    return Array.from(clientMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders, clients]);

  const cityStats = useMemo(() => {
    const cityMap = new Map<string, { name: string; revenue: number; profit: number; orders: number }>();
    
    orders.forEach(order => {
      let city = order.customerCity;
      if ((!city || city === '-') && order.clientId) {
        const client = clients.find(c => c.id === order.clientId);
        if (client && client.city && client.city.trim() !== '') {
          city = client.city;
        }
      }
      if (!city || city === '-') {
        city = 'Не указан';
      }
      
      if (!cityMap.has(city)) {
        cityMap.set(city, { name: city, revenue: 0, profit: 0, orders: 0 });
      }
      const c = cityMap.get(city)!;
      c.revenue += order.total;
      c.profit += order.totalProfit;
      c.orders += 1;
    });
    return Array.from(cityMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders, clients]);

  // Экспорт в Excel
  const exportToExcel = (): void => {
    let exportData: Record<string, unknown>[] = [];
    
    if (activeTab === 'overview') {
      exportData = orders.map(order => ({
        'Тип': order.documentType,
        'Номер документа': order.documentNumber,
        'Дата': formatDate(order.saleDate),
        'Покупатель': order.customerName || '-',
        'Телефон': order.customerPhone || '-',
        'Город': order.customerCity || '-',
        'Сумма': order.subtotal || 0,
        'Скидка': order.discount || 0,
        'Итого': order.total || 0,
        'Себестоимость': order.totalCost || 0,
        'Прибыль': order.totalProfit || 0,
        'Состав': order.items?.map(i => `${i.productName} x${i.quantity}`).join('; ') || '-'
      }));
    } else if (activeTab === 'products') {
      exportData = productStats.map(p => ({
        'Товар': p.name,
        'Количество продаж': p.quantity,
        'Выручка': p.revenue,
        'Себестоимость': p.cost,
        'Прибыль': p.profit,
        'Рентабельность': p.revenue > 0 ? ((p.profit / p.revenue) * 100).toFixed(1) + '%' : '0%'
      }));
    } else if (activeTab === 'clients') {
      exportData = clientStats.map(c => ({
        'Клиент': c.name,
        'Телефон': c.phone,
        'Город': c.city,
        'Количество заказов': c.orders,
        'Выручка': c.revenue,
        'Прибыль': c.profit,
        'Средний чек': c.orders > 0 ? c.revenue / c.orders : 0
      }));
    } else if (activeTab === 'cities') {
      exportData = cityStats.map(c => ({
        'Город': c.name,
        'Количество заказов': c.orders,
        'Выручка': c.revenue,
        'Прибыль': c.profit,
        'Средний чек': c.orders > 0 ? c.revenue / c.orders : 0
      }));
    } else if (activeTab === 'cost') {
      exportData = productsCostData.map(p => ({
        'Товар': p.productName,
        'Продано шт.': p.quantitySold,
        'Выручка': p.totalRevenue,
        'Себестоимость': p.totalCost,
        'Прибыль': p.totalProfit,
        'Маржинальность': p.totalRevenue > 0 ? ((p.totalProfit / p.totalRevenue) * 100).toFixed(1) + '%' : '0%',
        'Состав себестоимости': p.breakdown.map(b => `${b.name}: ${b.amount}`).join('; ')
      }));
    }
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Отчет_${activeTab}`);
    XLSX.writeFile(wb, `analytics_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Отчет экспортирован в Excel');
  };

  const handleProductClick = (product: ProductCostData) => {
    setSelectedProductCost(product);
    setIsCostModalOpen(true);
  };

  const metrics = [
    { title: 'Продаж', value: stats.totalOrders, icon: ShoppingBag, bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
    { title: 'Выручка', value: formatPrice(stats.totalRevenue), icon: DollarSign, bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400' },
    { title: 'Себестоимость', value: formatPrice(stats.totalCost), icon: Package, bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-600 dark:text-orange-400' },
    { title: 'Прибыль', value: formatPrice(stats.totalProfit), icon: TrendingUp, bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
    { title: 'Средний чек', value: formatPrice(stats.averageCheck), icon: Receipt, bg: 'bg-cyan-100 dark:bg-cyan-900/30', color: 'text-cyan-600 dark:text-cyan-400' },
    { title: 'Маржинальность', value: `${stats.margin.toFixed(1)}%`, icon: PieChartIcon, bg: stats.margin >= 30 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30', color: stats.margin >= 30 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' },
  ];

  if (loading && orders.length === 0) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Заголовок */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Аналитика</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Анализ продаж и прибыли с фильтрацией</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} icon={FileSpreadsheet} variant="success">
            Excel
          </Button>
        </div>
      </div>

      {/* Предупреждение о неоплаченных заказах */}
      {stats.unpaidCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400" />
          <p className="text-yellow-800 dark:text-yellow-300 text-sm">
            <span className="font-semibold">Внимание:</span> В аналитике учитываются только <strong>оплаченные заказы</strong>.
            В системе {stats.unpaidCount} неоплаченных заказов на сумму {formatPrice(stats.unpaidAmount)}.
          </p>
        </div>
      )}

      {/* Панель фильтров */}
      <FilterBar
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={handleResetFilters}
        onApply={handleApplyFilters}
        loading={loading}
        products={products}
        clients={clients}
      />

      {/* Метрики */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map((metric, idx) => (
          <Card key={idx} className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">{metric.title}</p>
                <p className="text-xl font-bold text-gray-900 dark:text-white">{metric.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${metric.bg} flex items-center justify-center`}>
                <metric.icon size={20} className={metric.color} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Вкладки */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-dark-700 pb-2">
        {[
          { id: 'overview' as const, label: 'Обзор', icon: BarChart3 },
          { id: 'products' as const, label: 'По товарам', icon: Package },
          { id: 'clients' as const, label: 'По покупателям', icon: Users },
          { id: 'cities' as const, label: 'По городам', icon: MapPin },
          { id: 'cost' as const, label: 'Себестоимость', icon: Calculator }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-300 hover:bg-gray-50 dark:hover:bg-dark-800'
            }`}
          >
            <tab.icon size={18} />
            <span className="text-sm font-medium">{tab.label}</span>
            <span className="text-xs bg-gray-100 dark:bg-dark-700 px-1.5 py-0.5 rounded-full">
              {tab.id === 'overview' ? orders.length :
               tab.id === 'products' ? productStats.length :
               tab.id === 'clients' ? clientStats.filter(c => c.orders > 0).length :
               tab.id === 'cities' ? cityStats.length :
               productsCostData.length}
            </span>
          </button>
        ))}
      </div>

      {/* Содержимое вкладок */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <Card>
            <CardBody className="p-6">
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Динамика продаж</h2>
                <div className="flex gap-2">
                  <Button variant={chartType === 'line' ? 'primary' : 'secondary'} size="sm" onClick={() => setChartType('line')} icon={LineChartIcon}>
                    Линейный
                  </Button>
                  <Button variant={chartType === 'bar' ? 'primary' : 'secondary'} size="sm" onClick={() => setChartType('bar')} icon={BarChart3}>
                    Столбчатый
                  </Button>
                </div>
              </div>
              {chartData.length > 0 ? (
                <ChartWrapper height={400}>
                  {chartType === 'line' ? (
                    <LineChart data={chartData} margin={{ bottom: 20, left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9ca3af" angle={-45} textAnchor="end" height={60} interval={Math.floor(chartData.length / 10)} />
                      <YAxis yAxisId="left" stroke="#9ca3af" />
                      <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                      <Tooltip formatter={(value) => formatPrice(value as number)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                      <Legend />
                      <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" name="Выручка" strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#8b5cf6" name="Прибыль" strokeWidth={2} />
                      <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#f59e0b" name="Себестоимость" strokeWidth={2} />
                    </LineChart>
                  ) : (
                    <BarChart data={chartData} margin={{ bottom: 20, left: 20, right: 20 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                      <XAxis dataKey="date" stroke="#9ca3af" angle={-45} textAnchor="end" height={60} interval={Math.floor(chartData.length / 10)} />
                      <YAxis stroke="#9ca3af" />
                      <Tooltip formatter={(value) => formatPrice(value as number)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                      <Legend />
                      <Bar dataKey="revenue" fill="#10b981" name="Выручка" />
                      <Bar dataKey="profit" fill="#8b5cf6" name="Прибыль" />
                      <Bar dataKey="cost" fill="#f59e0b" name="Себестоимость" />
                    </BarChart>
                  )}
                </ChartWrapper>
              ) : (
                <div className="h-400 flex items-center justify-center text-gray-500">
                  Нет данных за выбранный период
                </div>
              )}
            </CardBody>
          </Card>

          <Card>
            <CardBody className="p-0">
              <TableOrders orders={orders} />
            </CardBody>
          </Card>
        </div>
      )}

      {activeTab === 'products' && (
        <Card>
          <CardBody className="p-0">
            <TableProductStats 
              productStats={productStats} 
              productsCostData={productsCostData}
              onProductClick={handleProductClick}
            />
          </CardBody>
        </Card>
      )}

      {activeTab === 'clients' && (
        <Card>
          <CardBody className="p-0">
            <TableClientStats clientStats={clientStats} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'cities' && (
        <Card>
          <CardBody className="p-0">
            <CityStats cityStats={cityStats} totalRevenue={stats.totalRevenue} />
          </CardBody>
        </Card>
      )}

      {activeTab === 'cost' && (
        <div className="space-y-6">
          <Card>
            <CardBody className="p-6">
              <CostChart productsCostData={productsCostData} />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-6">
              <WorkTypeCostChart workTypeData={workTypeData} />
            </CardBody>
          </Card>
          <Card>
            <CardBody className="p-0">
              <TableCostData 
                productsCostData={productsCostData}
                onProductClick={handleProductClick}
              />
            </CardBody>
          </Card>
        </div>
      )}

      {/* Модалка */}
      <ProductCostModal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        product={selectedProductCost}
      />
    </div>
  );
};

export default Reports;