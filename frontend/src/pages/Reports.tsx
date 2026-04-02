// frontend/src/pages/Reports.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { reportsApi } from '../api/reports';
import { saleDocumentsApi } from '../api/saleDocuments';
import { productsApi } from '../api/products';
import { clientsApi } from '../api/clients';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
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
  Cell
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
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec489a', '#06b6d4', '#84cc16'];

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
  const [productSearch, setProductSearch] = useState<string>('');
  const [clientSearch, setClientSearch] = useState<string>('');
  const [citySearch, setCitySearch] = useState<string>(filters.city || '');
  const [showProductDropdown, setShowProductDropdown] = useState<boolean>(false);
  const [showClientDropdown, setShowClientDropdown] = useState<boolean>(false);

  useEffect(() => {
    setCitySearch(filters.city || '');
  }, [filters.city]);

  const filteredProducts = products.filter(p => 
    p.name.toLowerCase().includes(productSearch.toLowerCase()) ||
    p.article?.toLowerCase().includes(productSearch.toLowerCase())
  );

  const filteredClients = clients.filter(c => {
    const fullName = [c.lastName, c.firstName, c.middleName].filter(Boolean).join(' ').toLowerCase();
    return fullName.includes(clientSearch.toLowerCase()) ||
           c.phone.includes(clientSearch) ||
           c.city?.toLowerCase().includes(clientSearch.toLowerCase());
  });

  const handleCityChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setCitySearch(value);
    onFilterChange('city', value || null);
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

  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-500" />
          <h3 className="font-medium text-gray-900">Фильтры аналитики</h3>
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
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Товар</label>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={productSearch}
              onChange={(e) => setProductSearch(e.target.value)}
              onFocus={() => setShowProductDropdown(true)}
              placeholder="Поиск товара..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {showProductDropdown && filteredProducts.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredProducts.map(product => (
                <div
                  key={product.id}
                  className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-0 text-sm"
                  onClick={() => {
                    onFilterChange('product', product);
                    setProductSearch(product.name);
                    setShowProductDropdown(false);
                  }}
                >
                  <div className="font-medium">{product.name}</div>
                  <div className="text-xs text-gray-500">Арт: {product.article}</div>
                </div>
              ))}
            </div>
          )}
          {filters.product && (
            <div className="mt-1 flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full inline-flex">
              <span>Товар: {filters.product.name}</span>
              <button onClick={handleResetProduct} className="ml-1">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Покупатель</label>
          <div className="relative">
            <Users className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              onFocus={() => setShowClientDropdown(true)}
              placeholder="Поиск клиента..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {showClientDropdown && filteredClients.length > 0 && (
            <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
              {filteredClients.map(client => {
                const fullName = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');
                return (
                  <div
                    key={client.id}
                    className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-0 text-sm"
                    onClick={() => {
                      onFilterChange('client', client);
                      setClientSearch(fullName);
                      setShowClientDropdown(false);
                    }}
                  >
                    <div className="font-medium">{fullName}</div>
                    <div className="text-xs text-gray-500">{client.phone}</div>
                    {client.city && (
                      <div className="text-xs text-gray-400">🏙️ {client.city}</div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
          {filters.client && (
            <div className="mt-1 flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full inline-flex">
              <span>Клиент: {[filters.client.lastName, filters.client.firstName].filter(Boolean).join(' ')}</span>
              <button onClick={handleResetClient} className="ml-1">
                <X size={12} />
              </button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Город</label>
          <div className="relative">
            <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
            <input
              type="text"
              value={citySearch}
              onChange={handleCityChange}
              placeholder="Введите город..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
            />
          </div>
          {filters.city && (
            <div className="mt-1 flex items-center gap-1 text-xs bg-blue-50 text-blue-700 px-2 py-1 rounded-full inline-flex">
              <MapPin size={12} />
              <span>Город: {filters.city}</span>
              <button onClick={handleResetCity} className="ml-1">
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
  const [activeTab, setActiveTab] = useState<'overview' | 'products' | 'clients' | 'cities'>('overview');
  
  const [filters, setFilters] = useState<AnalyticsFilters>({
    product: null,
    client: null,
    city: null
  });

  useEffect(() => {
    loadInitialData();
  }, []);

  useEffect(() => {
    loadOrders();
  }, [period, startDate, endDate, filters]);

  const loadInitialData = async (): Promise<void> => {
    try {
      const [productsRes, clientsRes] = await Promise.all([
        productsApi.getAll(),
        clientsApi.getAll({ limit: 1000 })
      ]);
      setProducts(productsRes.data || []);
      setClients(clientsRes.data?.data?.clients || []);
    } catch (error) {
      console.error('Error loading initial data:', error);
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

  const handleFilterChange = (key: keyof AnalyticsFilters, value: Product | Client | string | null): void => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = (): void => {
    setFilters({ product: null, client: null, city: null });
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
    const productMap = new Map<string, { name: string; revenue: number; profit: number; quantity: number }>();
    orders.forEach(order => {
      order.items?.forEach(item => {
        if (!productMap.has(item.productName)) {
          productMap.set(item.productName, { name: item.productName, revenue: 0, profit: 0, quantity: 0 });
        }
        const p = productMap.get(item.productName)!;
        p.revenue += item.total;
        p.profit += (item.price - item.cost_price) * item.quantity;
        p.quantity += item.quantity;
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
    }
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Отчет_${activeTab}`);
    XLSX.writeFile(wb, `analytics_${activeTab}_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Отчет экспортирован в Excel');
  };

  const metrics = [
    { title: 'Продаж', value: stats.totalOrders, icon: ShoppingBag, bg: 'bg-blue-100', color: 'text-blue-600' },
    { title: 'Выручка', value: formatPrice(stats.totalRevenue), icon: DollarSign, bg: 'bg-green-100', color: 'text-green-600' },
    { title: 'Себестоимость', value: formatPrice(stats.totalCost), icon: Package, bg: 'bg-orange-100', color: 'text-orange-600' },
    { title: 'Прибыль', value: formatPrice(stats.totalProfit), icon: TrendingUp, bg: 'bg-purple-100', color: 'text-purple-600' },
    { title: 'Средний чек', value: formatPrice(stats.averageCheck), icon: Receipt, bg: 'bg-cyan-100', color: 'text-cyan-600' },
    { title: 'Маржинальность', value: `${stats.margin.toFixed(1)}%`, icon: PieChartIcon, bg: stats.margin >= 30 ? 'bg-green-100' : 'bg-yellow-100', color: stats.margin >= 30 ? 'text-green-600' : 'text-yellow-600' },
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
          <h1 className="text-3xl font-bold text-gray-900">Аналитика</h1>
          <p className="text-gray-500 mt-1">Анализ продаж и прибыли</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={exportToExcel} icon={FileSpreadsheet} variant="success">
            Excel
          </Button>
        </div>
      </div>

      {/* Предупреждение о неоплаченных заказах */}
      {stats.unpaidCount > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-yellow-600" />
          <p className="text-yellow-800 text-sm">
            <span className="font-semibold">Внимание:</span> В аналитике учитываются только <strong>оплаченные заказы</strong>.
            В системе {stats.unpaidCount} неоплаченных заказов на сумму {formatPrice(stats.unpaidAmount)}.
          </p>
        </div>
      )}

      {/* Фильтры даты */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Calendar size={18} className="text-gray-400" />
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
                  className="px-3 py-1.5 border rounded-lg text-sm"
                />
                <span className="text-gray-500">—</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="px-3 py-1.5 border rounded-lg text-sm"
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
                <p className="text-xs text-gray-500 mb-1">{metric.title}</p>
                <p className="text-xl font-bold text-gray-900">{metric.value}</p>
              </div>
              <div className={`w-10 h-10 rounded-xl ${metric.bg} flex items-center justify-center`}>
                <metric.icon size={20} className={metric.color} />
              </div>
            </div>
          </Card>
        ))}
      </div>

      {/* Вкладки аналитики */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 pb-2">
        {[
          { id: 'overview' as const, label: 'Обзор', icon: BarChart3 },
          { id: 'products' as const, label: 'По товарам', icon: Package },
          { id: 'clients' as const, label: 'По покупателям', icon: Users },
          { id: 'cities' as const, label: 'По городам', icon: MapPin }
        ].map(tab => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-50 text-primary-600 border-b-2 border-primary-600'
                : 'text-gray-500 hover:text-gray-700 hover:bg-gray-50'
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
              <h2 className="text-lg font-semibold text-gray-900">Динамика продаж</h2>
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
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip formatter={(value) => formatPrice(value as number)} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" name="Выручка" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#8b5cf6" name="Прибыль" strokeWidth={2} />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPrice(value as number)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" name="Выручка" />
                  <Bar dataKey="profit" fill="#8b5cf6" name="Прибыль" />
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
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Тип</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">№ документа</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Дата</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Покупатель</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Город</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Состав</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Итого</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {orders.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="text-center py-12">
                        <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300" />
                        <p className="text-gray-500">Нет оплаченных продаж за выбранный период</p>
                      </td>
                    </tr>
                  ) : (
                    orders.map((order) => (
                      <tr key={order.id} className="hover:bg-gray-50">
                        <td className="px-4 py-3 text-sm">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            order.documentType === 'Чек' ? 'bg-green-100 text-green-700' : 
                            order.documentType === 'Счет' ? 'bg-blue-100 text-blue-700' : 
                            'bg-purple-100 text-purple-700'
                          }`}>
                            {order.documentType}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-sm font-mono text-primary-600">{order.documentNumber}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{formatDate(order.saleDate)}</td>
                        <td className="px-4 py-3 text-sm text-gray-900">{order.customerName}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">{order.customerPhone}</td>
                        <td className="px-4 py-3 text-sm text-gray-500">
                          {order.customerCity && order.customerCity !== '-' ? (
                            <span className="flex items-center gap-1">
                              <MapPin size={12} className="text-gray-400" />
                              {order.customerCity}
                            </span>
                          ) : '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-gray-500 max-w-md truncate">
                          {order.items?.map(i => `${i.productName} x${i.quantity}`).join(', ') || '-'}
                        </td>
                        <td className="px-4 py-3 text-sm text-right font-semibold">{formatPrice(order.total)}</td>
                        <td className="px-4 py-3 text-sm text-right text-green-600">{formatPrice(order.totalProfit)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* Аналитика по товарам */}
      {activeTab === 'products' && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товар</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Количество</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выручка</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Рентабельность</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {productStats.map((product, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm text-gray-900">{product.name}</td>
                      <td className="px-4 py-3 text-sm text-right">{product.quantity} шт.</td>
                      <td className="px-4 py-3 text-sm text-right">{formatPrice(product.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">{formatPrice(product.profit)}</td>
                      <td className="px-4 py-3 text-sm text-right">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          product.revenue > 0 && (product.profit / product.revenue) > 0.3 ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {product.revenue > 0 ? ((product.profit / product.revenue) * 100).toFixed(1) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
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
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Клиент</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Телефон</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Город</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Заказов</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выручка</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Ср. чек</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {clientStats.map((client, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900">{client.name}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{client.phone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">
                        {client.city && client.city !== '-' ? (
                          <span className="flex items-center gap-1">
                            <MapPin size={12} className="text-gray-400" />
                            {client.city}
                          </span>
                        ) : '-'}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{client.orders}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatPrice(client.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">{formatPrice(client.profit)}</td>
                      <td className="px-4 py-3 text-sm text-right font-medium">{formatPrice(client.revenue / client.orders)}</td>
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
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 border-b border-gray-200">
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Выручка по городам</h3>
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
                    <Tooltip formatter={(value) => formatPrice(value as number)} />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div>
                <h3 className="font-medium text-gray-900 mb-4">Количество заказов по городам</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={cityStats.slice(0, 10)}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" angle={-45} textAnchor="end" height={80} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="orders" fill="#10b981" name="Заказов" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
            
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Город</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Заказов</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Выручка</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Средний чек</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Доля</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {cityStats.map((city, idx) => (
                    <tr key={idx} className="hover:bg-gray-50">
                      <td className="px-4 py-3 text-sm font-medium text-gray-900 flex items-center gap-2">
                        <MapPin size={14} className="text-gray-400" />
                        {city.name}
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{city.orders}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatPrice(city.revenue)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600">{formatPrice(city.profit)}</td>
                      <td className="px-4 py-3 text-sm text-right">{formatPrice(city.revenue / city.orders)}</td>
                      <td className="px-4 py-3 text-sm text-right">
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
    </div>
  );
};

export default Reports;