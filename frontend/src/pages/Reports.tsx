// frontend/src/pages/Reports.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { reportsApi } from '../api/reports';
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
 
} from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec489a', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];

// Интерфейс для данных о себестоимости товара
interface CostBreakdownItem {
  name: string;
  amount: number;
}

interface ProductCostData {
  productId: number;
  productName: string;
  totalCost: number;
  totalRevenue: number;
  totalProfit: number;
  breakdown: CostBreakdownItem[];
  salesCount: number;
  quantitySold: number;
}

// Компонент для отображения себестоимости товара в модалке
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
        {/* Статистика */}
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

        {/* График себестоимости */}
        {pieData.length > 0 && (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calculator size={16} className="text-primary-600" />
              Структура себестоимости
            </h4>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
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
                </ResponsiveContainer>
              </div>
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

        {pieData.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Calculator size={48} className="mx-auto mb-3 opacity-50" />
            <p>Нет данных о структуре себестоимости для этого товара</p>
            <p className="text-sm mt-2">Добавьте калькуляцию себестоимости при редактировании товара</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

// Компонент для графика себестоимости по товарам
const CostChart: React.FC<{ productsCostData: ProductCostData[] }> = ({ productsCostData }) => {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  
  // Данные для графика (топ-10 по себестоимости)
  const topByCost = [...productsCostData]
    .sort((a, b) => b.totalCost - a.totalCost)
    .slice(0, 10);

  // Данные для круговой диаграммы (все товары)
  const pieData = productsCostData
    .filter(p => p.totalCost > 0)
    .map((p, idx) => ({
      name: p.productName.length > 25 ? p.productName.slice(0, 22) + '...' : p.productName,
      value: p.totalCost,
      color: COLORS[idx % COLORS.length]
    }));

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
        <h3 className="font-medium text-gray-900 dark:text-white">Себестоимость товаров текущей страницы</h3>
        <div className="flex gap-2">
          <Button
            variant={chartType === 'bar' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setChartType('bar')}
          >
            Столбцы
          </Button>
          <Button
            variant={chartType === 'pie' ? 'primary' : 'secondary'}
            size="sm"
            onClick={() => setChartType('pie')}
          >
            Круговая
          </Button>
        </div>
      </div>

      <div className="h-96">
        {chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topByCost} layout="vertical" margin={{ left: 140, right: 20, top: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => formatPrice(value)} />
              <YAxis 
                type="category" 
                dataKey="productName" 
                width={140}
                tick={{ fontSize: 11 }}
                interval={0}
              />
              <Tooltip formatter={(value) => formatPrice(value as number)} />
              <Bar dataKey="totalCost" fill="#f59e0b" name="Себестоимость" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        )}
      </div>
    </div>
  );
};

// Компонент для графика себестоимости по категориям работ
const WorkTypeCostChart: React.FC<{ workTypeData: CostBreakdownItem[] }> = ({ workTypeData }) => {
  if (workTypeData.length === 0) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Wrench size={48} className="mx-auto mb-3 opacity-50" />
        <p>Нет данных о затратах по видам работ</p>
        <p className="text-sm mt-2">Добавьте калькуляцию себестоимости в карточке товара</p>
      </div>
    );
  }

  // Обрезаем длинные названия
  const shortNamesData = workTypeData.map(item => ({
    ...item,
    name: item.name.length > 20 ? item.name.slice(0, 17) + '...' : item.name
  }));

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <Wrench size={16} className="text-primary-600" />
        Затраты по видам работ (текущая страница)
      </h3>
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
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
          </ResponsiveContainer>
        </div>
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
};

interface AnalyticsFilters {
  product: Product | null;
  client: Client | null;
  city: string | null;
}

interface AnalyticsFiltersProps {
  filters: AnalyticsFilters;
  onFilterChange: (key: keyof AnalyticsFilters, value: Product | Client | string | null) => void;
  onReset: () => void;
}

const AnalyticsFiltersComponent: React.FC<AnalyticsFiltersProps> = ({ 
  filters, onFilterChange, onReset
}) => {
  const [productSearch, setProductSearch] = useState<string>(filters.product?.name || '');
  const [clientSearch, setClientSearch] = useState<string>(() => {
    if (filters.client) {
      const fullName = [filters.client.lastName, filters.client.firstName, filters.client.middleName]
        .filter(Boolean)
        .join(' ');
      return fullName;
    }
    return '';
  });
  const [citySearch, setCitySearch] = useState<string>(filters.city || '');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);
  
  const productSearchRef = useRef<HTMLDivElement>(null);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  // Закрытие дропдаунов при клике вне области
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) {
        setShowProductDropdown(false);
      }
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) {
        setShowClientDropdown(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Фильтрация продуктов
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { productsApi.getAll({ search: productSearch, page: 1, limit: 20 })
      .then(result => { if (active) setFilteredProducts(result.data); }).catch(() => { if (active) setFilteredProducts([]); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [productSearch]);
  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => { clientsApi.getAll({ search: clientSearch, page: 1, limit: 20 })
      .then(result => { if (active) { const data: any = result.data; setFilteredClients(Array.isArray(data) ? data : data?.data || data?.clients || []); } })
      .catch(() => { if (active) setFilteredClients([]); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [clientSearch]);

  const handleProductSelect = (product: Product): void => {
    onFilterChange('product', product);
    setProductSearch(product.name);
    setShowProductDropdown(false);
  };

  const handleClientSelect = (client: Client): void => {
    onFilterChange('client', client);
    const fullName = [client.lastName, client.firstName, client.middleName]
      .filter(Boolean)
      .join(' ');
    setClientSearch(fullName);
    setShowClientDropdown(false);
  };

  const handleResetProduct = (): void => {
    onFilterChange('product', null);
    setProductSearch('');
  };

  const handleResetClient = (): void => {
    onFilterChange('client', null);
    setClientSearch('');
  };

  const handleResetCity = (): void => {
    onFilterChange('city', null);
    setCitySearch('');
  };

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setCitySearch(value);
    onFilterChange('city', value || null);
  };

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-500 dark:text-gray-400" />
          <h3 className="font-medium text-gray-900 dark:text-white">Фильтры аналитики</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={() => {
          onReset();
          setProductSearch('');
          setClientSearch('');
          setCitySearch('');
        }}>
          Сбросить все
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Фильтр по товару */}
        <div ref={productSearchRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Товар</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => {
                setProductSearch(e.target.value);
                setShowProductDropdown(true);
                if (filters.product) onFilterChange('product', null);
              }}
              onFocus={() => setShowProductDropdown(true)}
              placeholder="Поиск товара..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {showProductDropdown && filteredProducts.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-dark-800 border dark:border-dark-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="p-2 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer border-b last:border-0 text-sm"
                  onClick={() => handleProductSelect(product)}
                >
                  <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                  <div className="text-xs text-gray-500 dark:text-gray-400">Арт: {product.article}</div>
                </div>
              ))}
            </div>
          )}
          {filters.product && (
            <div className="mt-1 flex items-center gap-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-1 rounded-full inline-flex">
              <span>Товар: {filters.product.name}</span>
              <button onClick={handleResetProduct} className="ml-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full p-0.5">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Фильтр по клиенту */}
        <div ref={clientSearchRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Покупатель</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => {
                setClientSearch(e.target.value);
                setShowClientDropdown(true);
                if (filters.client) onFilterChange('client', null);
              }}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Поиск клиента..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {showClientDropdown && filteredClients.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-dark-800 border dark:border-dark-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredClients.map(client => {
                const fullName = [client.lastName, client.firstName, client.middleName]
                  .filter(Boolean)
                  .join(' ') || client.firstName;
                return (
                  <div
                    key={client.id}
                    className="p-2 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer border-b last:border-0 text-sm"
                    onClick={() => handleClientSelect(client)}
                  >
                    <div className="font-medium text-gray-900 dark:text-white">{fullName}</div>
                    <div className="text-xs text-gray-500 dark:text-gray-400">📞 {client.phone}</div>
                    {client.city && (
                      <div className="text-xs text-gray-400 dark:text-gray-500">🏙️ {client.city}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {showClientDropdown && filteredClients.length === 0 && clientSearch && (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-dark-800 border dark:border-dark-700 rounded-lg shadow-lg p-3 text-center text-sm text-gray-500">
              Клиенты не найдены
            </div>
          )}
          {filters.client && (
            <div className="mt-1 flex items-center gap-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-1 rounded-full inline-flex">
              <span>Клиент: {[filters.client.lastName, filters.client.firstName].filter(Boolean).join(' ')}</span>
              <button onClick={handleResetClient} className="ml-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full p-0.5">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        {/* Фильтр по городу */}
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Город</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={citySearch}
              onChange={handleCityChange}
              placeholder="Введите город..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {filters.city && (
            <div className="mt-1 flex items-center gap-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400 px-2 py-1 rounded-full inline-flex">
              <MapPin size={12} />
              <span>Город: {filters.city}</span>
              <button onClick={handleResetCity} className="ml-1 hover:bg-primary-100 dark:hover:bg-primary-800 rounded-full p-0.5">
                <X size={12} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

interface FormattedSale extends SaleDocument {
  totalProfit: number;
  totalCost: number;
  customerCity: string;
}

export const Reports: React.FC = () => {
  const [loading, setLoading] = useState<boolean>(true);
  const [loadError, setLoadError] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const requestVersion = useRef(0);
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
  
  const [period, setPeriod] = useState<string>('month');
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');
  const [showCustom, setShowCustom] = useState<boolean>(false);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'clients' | 'cities' | 'cost'>('overview');
  
  const [filters, setFilters] = useState<AnalyticsFilters>({
    product: null,
    client: null,
    city: null
  });

  // Состояния для модалки себестоимости
  const [selectedProductCost, setSelectedProductCost] = useState<ProductCostData | null>(null);
  const [isCostModalOpen, setIsCostModalOpen] = useState<boolean>(false);

  const queryParams = useMemo(() => {
    let from: Date | undefined;
    let to: Date | undefined;
    if (period === 'custom' && startDate && endDate) {
      from = new Date(startDate); to = new Date(endDate); to.setHours(23, 59, 59, 999);
    } else if (period !== 'custom' && period !== 'all') {
      from = new Date();
      if (period === 'day') from.setHours(0, 0, 0, 0);
      if (period === 'week') from.setDate(from.getDate() - 7);
      if (period === 'month') from.setMonth(from.getMonth() - 1);
      if (period === 'year') from.setFullYear(from.getFullYear() - 1);
    }
    return { startDate: from?.toISOString(), endDate: to?.toISOString(), productId: filters.product?.id,
      clientId: filters.client?.id, city: filters.city || undefined };
  }, [period, startDate, endDate, filters]);
  useEffect(() => { setPage(1); }, [queryParams, activeTab]);
  useEffect(() => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(false);
    reportsApi.getAnalytics({ ...queryParams, tab: activeTab, page, limit: 50 }).then(result => {
      if (version !== requestVersion.current) return;
      setRows(result.rows); setRowCount(result.total); setStats(result.stats);
      setChartData(result.chart.map(row => ({ ...row, date: new Date(row.day).toLocaleDateString('ru-RU') })));
    }).catch(() => { if (version === requestVersion.current) { setLoadError(true); toast.error('Ошибка загрузки аналитики'); } })
      .finally(() => { if (version === requestVersion.current) setLoading(false); });
    return () => { requestVersion.current++; };
  }, [queryParams, activeTab, page, revision]);

  const orders: FormattedSale[] = activeTab === 'overview' ? rows.map(row => ({ ...row,
    documentType: row.documentType === 'receipt' ? 'Чек' : row.documentType === 'invoice' ? 'Счёт' : 'Заказ' })) : [];
  const productsCostData: ProductCostData[] = activeTab === 'cost' ? rows : [];
  const productStats: any[] = activeTab === 'products' ? rows : [];
  const clientStats: any[] = activeTab === 'clients' ? rows : [];
  const cityStats: any[] = activeTab === 'cities' ? rows : [];
  const workTypeData = useMemo(() => {
    const totals = new Map<string, number>();
    productsCostData.forEach(product => product.breakdown.forEach(item => totals.set(item.name, (totals.get(item.name) || 0) + item.amount)));
    return [...totals].map(([name, amount]) => ({ name, amount })).sort((a, b) => b.amount - a.amount);
  }, [rows, activeTab]);

  const handleFilterChange = (key: keyof AnalyticsFilters, value: Product | Client | string | null): void => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = (): void => {
    setFilters({ product: null, client: null, city: null });
  };

  const handleProductClick = (product: ProductCostData): void => {
    setSelectedProductCost(product);
    setIsCostModalOpen(true);
  };

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
    toast.success('Текущая страница экспортирована в Excel');
  };

  const metrics = [
    { title: 'Продаж', value: stats.totalOrders, icon: ShoppingBag, bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
    { title: 'Выручка', value: formatPrice(stats.totalRevenue), icon: DollarSign, bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400' },
    { title: 'Себестоимость', value: formatPrice(stats.totalCost), icon: Package, bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-600 dark:text-orange-400' },
    { title: 'Прибыль', value: formatPrice(stats.totalProfit), icon: TrendingUp, bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
    { title: 'Средний чек', value: formatPrice(stats.averageCheck), icon: Receipt, bg: 'bg-cyan-100 dark:bg-cyan-900/30', color: 'text-cyan-600 dark:text-cyan-400' },
    { title: 'Маржинальность', value: `${stats.margin.toFixed(1)}%`, icon: PieChartIcon, bg: stats.margin >= 30 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30', color: stats.margin >= 30 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  if (loadError) return <div role="alert">Не удалось загрузить аналитику. Обновите страницу, чтобы повторить запрос.</div>;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Аналитика</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Итоги по всему фильтру; таблицы, групповые диаграммы и Excel по текущей странице. График по датам: последние 120 дней с продажами.</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} icon={FileSpreadsheet} variant="success">
            Excel: текущая страница
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

      {/* Фильтры даты */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Calendar size={18} className="text-gray-400 dark:text-gray-500" />
            <div className="flex gap-2">
              {(['day', 'week', 'month', 'year'] as const).map(p => (
                <Button
                  key={p}
                  variant={period === p ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => {
                    setPeriod(p);
                    setShowCustom(false);
                  }}
                >
                  {p === 'day' ? 'День' : p === 'week' ? 'Неделя' : p === 'month' ? 'Месяц' : 'Год'}
                </Button>
              ))}
              <Button
                variant={period === 'custom' ? 'primary' : 'secondary'}
                size="sm"
                onClick={() => {
                  setPeriod('custom');
                  setShowCustom(true);
                }}
              >
                Произвольный
              </Button>
            </div>
            
            {showCustom && (
              <div className="flex gap-2 items-center">
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm dark:bg-dark-800 dark:border-dark-700 dark:text-white"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm dark:bg-dark-800 dark:border-dark-700 dark:text-white"
                />
                <Button size="sm" onClick={() => { setPage(1); setRevision(value => value + 1); }}>Применить</Button>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Фильтры аналитики */}
      <AnalyticsFiltersComponent
        filters={filters}
        onFilterChange={handleFilterChange}
        onReset={resetFilters}
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

      {/* Вкладки аналитики */}
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
          </button>
        ))}
      </div>

      {/* Графики для обзора */}
      {activeTab === 'overview' && chartData.length > 0 && (
        <Card>
          <CardBody className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Динамика продаж</h2>
              <div className="flex gap-2">
                <Button
                  variant={chartType === 'line' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setChartType('line')}
                  icon={LineChartIcon}
                >
                  Линейный
                </Button>
                <Button
                  variant={chartType === 'bar' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setChartType('bar')}
                  icon={BarChart3}
                >
                  Столбчатый
                </Button>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={400}>
              {chartType === 'line' ? (
                <LineChart data={chartData} margin={{ bottom: 20, left: 20, right: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis 
                    dataKey="date" 
                    stroke="#9ca3af"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={Math.floor(chartData.length / 10)}
                  />
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
                  <XAxis 
                    dataKey="date" 
                    stroke="#9ca3af"
                    angle={-45}
                    textAnchor="end"
                    height={60}
                    interval={Math.floor(chartData.length / 10)}
                  />
                  <YAxis stroke="#9ca3af" />
                  <Tooltip formatter={(value) => formatPrice(value as number)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" name="Выручка" />
                  <Bar dataKey="profit" fill="#8b5cf6" name="Прибыль" />
                  <Bar dataKey="cost" fill="#f59e0b" name="Себестоимость" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Таблица продаж для обзора */}
      {activeTab === 'overview' && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Тип</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">№ документа</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Дата</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Покупатель</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Телефон</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Город</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Состав</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Итого</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Прибыль</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12">
                        <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300 dark:text-gray-600" />
                        <p className="text-gray-500 dark:text-gray-400">Нет оплаченных продаж за выбранный период</p>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
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
                          {order.items?.map(i => `${i.productName} x${i.quantity}`).join(', ') || '-'}{(order as any).itemCount > 200 ? ' (первые 200 позиций)' : ''}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">{formatPrice(order.total)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatPrice(order.totalProfit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Аналитика по товарам с себестоимостью */}
      {activeTab === 'products' && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Товар</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Количество</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Выручка</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Себестоимость</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Прибыль</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Рентабельность</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Детали</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {productStats.map((product, idx) => {
                    const costData = productsCostData.find(p => p.productName === product.name);
                    return (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.name}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{product.quantity} шт.</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatPrice(product.revenue)}</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">{formatPrice(product.cost)}</td>
                        <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{formatPrice(product.profit)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            product.revenue > 0 && (product.profit / product.revenue) > 0.3 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {product.revenue > 0 ? ((product.profit / product.revenue) * 100).toFixed(1) : 0}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {costData && costData.breakdown.length > 0 && (
                            <button
                              onClick={() => handleProductClick(costData)}
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
          </CardBody>
        </Card>
      )}

      {/* Аналитика по клиентам - ИСПРАВЛЕНО */}
      {activeTab === 'clients' && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Клиент</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Телефон</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Город</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Заказов</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Выручка</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Прибыль</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Ср. чек</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {clientStats.map((client, idx) => (
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
          </CardBody>
        </Card>
      )}

      {/* Аналитика по городам - ИСПРАВЛЕНО */}
      {activeTab === 'cities' && (
        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 border-b border-gray-200 dark:border-dark-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Выручка по городам</h3>
                {cityStats.filter(c => c.name !== 'Не указан').length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart margin={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                      <Pie
                        data={cityStats.filter(c => c.name !== 'Не указан').slice(0, 8)}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                        labelLine={true}
                      >
                        {cityStats.filter(c => c.name !== 'Не указан').slice(0, 8).map((_, index) => (
                          <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                        ))}
                      </Pie>
                      <Tooltip formatter={(value) => formatPrice(value as number)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                      <Legend layout="vertical" align="right" verticalAlign="middle" wrapperStyle={{ fontSize: '12px' }} />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-400 flex items-center justify-center text-gray-500">
                    Нет данных о городах
                  </div>
                )}
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Количество заказов по городам</h3>
                <ResponsiveContainer width="100%" height={400}>
                  <BarChart data={cityStats.slice(0, 10)} margin={{ bottom: 60 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis 
                      dataKey="name" 
                      angle={-45} 
                      textAnchor="end" 
                      height={80} 
                      stroke="#9ca3af"
                      interval={0}
                      tick={{ fontSize: 11 }}
                    />
                    <YAxis stroke="#9ca3af" />
                    <Tooltip contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                    <Bar dataKey="orders" fill="#10b981" name="Заказов" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Город</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Заказов</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Выручка</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Прибыль</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Средний чек</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Доля</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {cityStats.map((city, idx) => (
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
                        {stats.totalRevenue > 0 ? ((city.revenue / stats.totalRevenue) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Аналитика по себестоимости */}
      {activeTab === 'cost' && (
        <div className="space-y-6">
          {/* Общий график себестоимости по товарам */}
          <Card>
            <CardBody className="p-6">
              <CostChart productsCostData={productsCostData} />
            </CardBody>
          </Card>

          {/* График затрат по видам работ */}
          <Card>
            <CardBody className="p-6">
              <WorkTypeCostChart workTypeData={workTypeData} />
            </CardBody>
          </Card>

          {/* Таблица себестоимости по товарам */}
          <Card>
            <CardBody className="p-0">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Товар</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Продано</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Выручка</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Себестоимость</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Прибыль</th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Маржинальность</th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">Состав</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                    {productsCostData.map((product, idx) => (
                      <tr key={idx} className="hover:bg-gray-50 dark:hover:bg-dark-800">
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{product.productName}</td>
                        <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">{product.quantitySold} шт.</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">{formatPrice(product.totalRevenue)}</td>
                        <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">{formatPrice(product.totalCost)}</td>
                        <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">{formatPrice(product.totalProfit)}</td>
                        <td className="px-4 py-3 text-sm text-right">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            product.totalRevenue > 0 && (product.totalProfit / product.totalRevenue) > 0.3 ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400' : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                          }`}>
                            {product.totalRevenue > 0 ? ((product.totalProfit / product.totalRevenue) * 100).toFixed(1) : 0}%
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm text-center">
                          {product.breakdown.length > 0 && (
                            <button
                              onClick={() => handleProductClick(product)}
                              className="p-1 text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/30 rounded transition-colors"
                              title="Показать структуру себестоимости"
                            >
                              <Info size={18} />
                            </button>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* Модалка с детальной себестоимостью товара */}
      <div className="flex items-center justify-between gap-3">
        <span>Всего: {rowCount}. Страница {page} из {Math.max(1, Math.ceil(rowCount / 50))}</span>
        <div className="flex gap-2">
          <Button disabled={page <= 1} onClick={() => setPage(value => value - 1)}>Назад</Button>
          <Button disabled={page * 50 >= rowCount} onClick={() => setPage(value => value + 1)}>Далее</Button>
        </div>
      </div>
      <ProductCostModal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        product={selectedProductCost}
      />
    </div>
  );
};
export default Reports;
