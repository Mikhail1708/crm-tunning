// frontend/src/pages/Reports.tsx
import React, { useState, useEffect, useMemo, useRef } from 'react';
import { reportsApi } from '../api/reports';
import { saleDocumentsApi } from '../api/saleDocuments';
import { productsApi } from '../api/products';
import { clientsApi } from '../api/clients';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { formatPrice, formatDate } from '../utils/formatters';
import { SaleDocument, Product, Client, ReportSummary, ProductStat, ClientStat, CityStat } from '../types';
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
  AreaChart,
  Area
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
  Truck,
  PaintBucket,
  Gauge,
  ClipboardList
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
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <ResponsiveContainer width="100%" height={250}>
                  <PieChart>
                    <Pie
                      data={pieData}
                      dataKey="value"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={80}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {pieData.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={entry.color} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatPrice(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="space-y-2">
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
      name: p.productName.length > 20 ? p.productName.slice(0, 20) + '...' : p.productName,
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
        <h3 className="font-medium text-gray-900 dark:text-white">Общая себестоимость проданных товаров</h3>
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

      <div className="h-80">
        {chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topByCost} layout="vertical" margin={{ left: 100 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={(value) => formatPrice(value)} />
              <YAxis type="category" dataKey="productName" width={120} />
              <Tooltip formatter={(value) => formatPrice(value as number)} />
              <Bar dataKey="totalCost" fill="#f59e0b" name="Себестоимость" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={pieData.slice(0, 10)}
                dataKey="value"
                nameKey="name"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
              >
                {pieData.slice(0, 10).map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip formatter={(value) => formatPrice(value as number)} />
              <Legend />
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

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <Wrench size={16} className="text-primary-600" />
        Затраты по видам работ (все товары)
      </h3>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ResponsiveContainer width="100%" height={300}>
          <PieChart>
            <Pie
              data={workTypeData}
              dataKey="amount"
              nameKey="name"
              cx="50%"
              cy="50%"
              outerRadius={100}
              label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
            >
              {workTypeData.map((_, index) => (
                <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip formatter={(value) => formatPrice(value as number)} />
            <Legend />
          </PieChart>
        </ResponsiveContainer>
        <div className="space-y-2 overflow-y-auto max-h-80">
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
  products: Product[];
  clients: Client[];
}

const AnalyticsFiltersComponent: React.FC<AnalyticsFiltersProps> = ({ 
  filters, onFilterChange, onReset, products, clients 
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
  const filteredProducts = useMemo(() => {
    if (!productSearch.trim()) return products;
    const searchLower = productSearch.toLowerCase();
    return products.filter(p => 
      p.name.toLowerCase().includes(searchLower) ||
      p.article?.toLowerCase().includes(searchLower)
    );
  }, [products, productSearch]);

  // Фильтрация клиентов
  const filteredClients = useMemo(() => {
    if (!clientSearch.trim()) return clients;
    const searchLower = clientSearch.toLowerCase();
    return clients.filter(c => {
      const fullName = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ').toLowerCase();
      return fullName.includes(searchLower) ||
             c.phone.includes(clientSearch) ||
             (c.city && c.city.toLowerCase().includes(searchLower));
    });
  }, [clients, clientSearch]);

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

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [period, startDate, endDate, filters]);

  const loadInitialData = async (): Promise<void> => {
  try {
    const [productsRes, clientsRes, allProductsRes] = await Promise.all([
      productsApi.getAll(),
      clientsApi.getAll({ limit: 1000 }),
      productsApi.getAll()
    ]);
    
    // Исправление: правильно извлекаем данные клиентов
    let clientsData: Client[] = [];
    if (clientsRes.data) {
      if (Array.isArray(clientsRes.data)) {
        clientsData = clientsRes.data;
      } else if (clientsRes.data.data && Array.isArray(clientsRes.data.data)) {
        clientsData = clientsRes.data.data;
      } else if (clientsRes.data.clients && Array.isArray(clientsRes.data.clients)) {
        clientsData = clientsRes.data.clients;
      } else if (Array.isArray(clientsRes)) {
        clientsData = clientsRes;
      }
    }
    
    console.log('📋 Загружено клиентов:', clientsData.length);
    
    setProducts(productsRes.data || []);
    setClients(clientsData);
    setAllProducts(allProductsRes.data || []);
  } catch (error) {
    console.error('Error loading initial data:', error);
    toast.error('Ошибка загрузки данных для фильтров');
  }
};

  const loadOrders = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await saleDocumentsApi.getAll();
      let allDocuments = response.data || [];
      
      let paidDocuments = allDocuments.filter(doc => doc.paymentStatus === 'paid');
      
      let filteredSales = [...paidDocuments];
      
      if (period === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredSales = paidDocuments.filter(sale => {
          const saleDate = new Date(sale.saleDate);
          return saleDate >= start && saleDate <= end;
        });
      } else if (period !== 'custom') {
        let startDateFilter: Date | null = null;
        switch (period) {
          case 'day':
            startDateFilter = new Date();
            startDateFilter.setHours(0, 0, 0, 0);
            break;
          case 'week':
            startDateFilter = new Date();
            startDateFilter.setDate(startDateFilter.getDate() - 7);
            break;
          case 'month':
            startDateFilter = new Date();
            startDateFilter.setMonth(startDateFilter.getMonth() - 1);
            break;
          case 'year':
            startDateFilter = new Date();
            startDateFilter.setFullYear(startDateFilter.getFullYear() - 1);
            break;
        }
        if (startDateFilter) {
          filteredSales = paidDocuments.filter(sale => new Date(sale.saleDate) >= startDateFilter!);
        }
      }
      
      if (filters.product) {
        filteredSales = filteredSales.filter(sale => 
          sale.items?.some(item => item.productId === filters.product!.id)
        );
      }
      
      if (filters.client) {
        filteredSales = filteredSales.filter(sale => 
          sale.clientId === filters.client!.id
        );
      }
      
      if (filters.city) {
        filteredSales = filteredSales.filter(sale => {
          const clientCity = sale.client?.city || '';
          return clientCity.toLowerCase().includes(filters.city!.toLowerCase());
        });
      }
      
      const unpaidDocuments = allDocuments.filter(doc => doc.paymentStatus !== 'paid');
      const unpaidAmount = unpaidDocuments.reduce((sum, d) => sum + (d.total || 0), 0);
      
      const formattedSales: FormattedSale[] = filteredSales.map(sale => {
        const itemsWithCost = (sale.items || []).map(item => {
          const costPrice = item.cost_price || (item as { product?: { cost_price: number } }).product?.cost_price || 0;
          return {
            name: item.productName || (item as { product?: { name: string } }).product?.name || 'Товар',
            article: item.productArticle || (item as { product?: { article: string } }).product?.article || '-',
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
        
        const docType = sale.documentType === 'receipt' ? 'Чек' : sale.documentType === 'invoice' ? 'Счет' : 'Заказ';
        
        return {
          ...sale,
          documentType: docType,
          totalProfit,
          totalCost,
          customerCity: sale.client?.city || '-'
        };
      });
      
      setOrders(formattedSales);
      
      const totalOrders = formattedSales.length;
      const totalRevenue = formattedSales.reduce((sum, o) => sum + o.total, 0);
      const totalCost = formattedSales.reduce((sum, o) => sum + o.totalCost, 0);
      const totalProfit = totalRevenue - totalCost;
      const averageCheck = totalOrders > 0 ? totalRevenue / totalOrders : 0;
      const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      
      setStats({
        totalOrders,
        totalRevenue,
        totalProfit,
        totalCost,
        averageCheck,
        margin,
        unpaidCount: unpaidDocuments.length,
        unpaidAmount: unpaidAmount
      });
      
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Ошибка загрузки отчетов');
    } finally {
      setLoading(false);
    }
  };

  // Данные о себестоимости товаров на основе проданных товаров и их costBreakdown
  const productsCostData = useMemo((): ProductCostData[] => {
    const productMap = new Map<number, ProductCostData>();
    
    // Сначала собираем данные по продажам
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
        
        // Добавляем breakdown из структуры товара
        if (product?.costBreakdown && product.costBreakdown.length > 0) {
          product.costBreakdown.forEach((breakItem: CostBreakdownItem) => {
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

  // Агрегированные данные по видам работ (для всех товаров)
  const workTypeData = useMemo((): CostBreakdownItem[] => {
    const workMap = new Map<string, number>();
    
    productsCostData.forEach(product => {
      product.breakdown.forEach(breakItem => {
        const current = workMap.get(breakItem.name) || 0;
        workMap.set(breakItem.name, current + breakItem.amount);
      });
    });
    
    return Array.from(workMap.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [productsCostData]);

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
        if (!productMap.has(item.productName)) {
          productMap.set(item.productName, { 
            name: item.productName, 
            revenue: 0, 
            profit: 0, 
            quantity: 0,
            cost: 0,
            productId: item.productId
          });
        }
        const p = productMap.get(item.productName)!;
        p.revenue += item.total;
        p.profit += (item.price - item.cost_price) * item.quantity;
        p.quantity += item.quantity;
        p.cost += (item.cost_price || 0) * item.quantity;
      });
    });
    return Array.from(productMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const clientStats = useMemo(() => {
    const clientMap = new Map<string, { name: string; phone?: string; city?: string; revenue: number; profit: number; orders: number }>();
    orders.forEach(order => {
      if (order.customerName && order.customerName !== '-') {
        if (!clientMap.has(order.customerName)) {
          clientMap.set(order.customerName, { 
            name: order.customerName, 
            phone: order.customerPhone,
            city: order.customerCity,
            revenue: 0, 
            profit: 0, 
            orders: 0 
          });
        }
        const c = clientMap.get(order.customerName)!;
        c.revenue += order.total;
        c.profit += order.totalProfit;
        c.orders += 1;
      }
    });
    return Array.from(clientMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

  const cityStats = useMemo(() => {
    const cityMap = new Map<string, { name: string; revenue: number; profit: number; orders: number }>();
    orders.forEach(order => {
      const city = order.customerCity && order.customerCity !== '-' ? order.customerCity : 'Не указан';
      if (!cityMap.has(city)) {
        cityMap.set(city, { name: city, revenue: 0, profit: 0, orders: 0 });
      }
      const c = cityMap.get(city)!;
      c.revenue += order.total;
      c.profit += order.totalProfit;
      c.orders += 1;
    });
    return Array.from(cityMap.values()).sort((a, b) => b.revenue - a.revenue);
  }, [orders]);

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

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Аналитика</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Анализ продаж и прибыли</p>
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
                <Button size="sm" onClick={loadOrders}>Применить</Button>
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
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
                  <YAxis yAxisId="left" stroke="#9ca3af" />
                  <YAxis yAxisId="right" orientation="right" stroke="#9ca3af" />
                  <Tooltip formatter={(value) => formatPrice(value as number)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" name="Выручка" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#8b5cf6" name="Прибыль" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#f59e0b" name="Себестоимость" strokeWidth={2} />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                  <XAxis dataKey="date" stroke="#9ca3af" />
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
                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">{order.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">{order.customerPhone}</td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {order.customerCity && order.customerCity !== '-' ? (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} className="text-gray-400" />
                              {order.customerCity}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400 max-w-md truncate">
                          {order.items?.map(i => `${i.productName} x${i.quantity}`).join(', ') || '-'}
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

      {/* Аналитика по клиентам */}
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
                      <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                        {client.city && client.city !== '-' ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400" />
                            {client.city}
                          </span>
                        ) : '-'}
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

      {/* Аналитика по городам */}
      {activeTab === 'cities' && (
        <Card>
          <CardBody className="p-0">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 border-b border-gray-200 dark:border-dark-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Выручка по городам</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={cityStats.slice(0, 8)}
                      dataKey="revenue"
                      nameKey="name"
                      cx="50%"
                      cy="50%"
                      outerRadius={100}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                    >
                      {cityStats.slice(0, 8).map((_, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(value) => formatPrice(value as number)} contentStyle={{ backgroundColor: '#1f2937', border: 'none', borderRadius: '8px' }} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">Количество заказов по городам</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cityStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#374151" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} stroke="#9ca3af" />
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
      <ProductCostModal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        product={selectedProductCost}
      />
    </div>
  );
};

export default Reports;