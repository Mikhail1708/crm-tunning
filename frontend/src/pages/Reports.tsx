// frontend/src/pages/Reports.tsx
import React, { useEffect, useMemo, useRef, useState } from 'react';
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
  LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, PieChart, Pie, Cell
} from 'recharts';
import {
  TrendingUp, Loader, DollarSign, Package, PieChart as PieChartIcon, ShoppingBag,
  Receipt, Calendar, Users, MapPin, Search, Filter, BarChart3,
  LineChart as LineChartIcon, X, FileSpreadsheet, AlertCircle, Info,
  Calculator, Wrench, ArrowUpDown
} from 'lucide-react';
import toast from 'react-hot-toast';

const COLORS = ['#10b981', '#8b5cf6', '#f59e0b', '#ef4444', '#3b82f6', '#ec489a', '#06b6d4', '#84cc16', '#f97316', '#a855f7'];

type ReportPeriod = 'day' | 'week' | 'month' | 'year' | 'custom' | 'all';
type AnalyticsTab = 'overview' | 'products' | 'clients' | 'cities' | 'cost';
type SortDirection = 'asc' | 'desc';

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
  breakdown?: CostBreakdownItem[];
  salesCount: number;
  quantitySold: number;
}

interface AnalyticsFilters {
  product: Product | null;
  client: Client | null;
  city: string | null;
}

interface TableFilters {
  minQuantity: string;
  maxQuantity: string;
  minRevenue: string;
  maxRevenue: string;
  minProfit: string;
  maxProfit: string;
  minCost: string;
  maxCost: string;
  minAverage: string;
  maxAverage: string;
  minMargin: string;
  maxMargin: string;
  sortBy: string;
  sortDirection: SortDirection;
}

const EMPTY_TABLE_FILTERS: TableFilters = {
  minQuantity: '', maxQuantity: '',
  minRevenue: '', maxRevenue: '',
  minProfit: '', maxProfit: '',
  minCost: '', maxCost: '',
  minAverage: '', maxAverage: '',
  minMargin: '', maxMargin: '',
  sortBy: '', sortDirection: 'desc'
};

const toDateInputValue = (date: Date) => {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
};

const parseDateInputValue = (value: string): Date | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  if (date.getFullYear() !== y || date.getMonth() !== m - 1 || date.getDate() !== d) return null;
  return date;
};

const getPresetDateRange = (period: ReportPeriod) => {
  const now = new Date();
  const end = new Date(now);
  end.setHours(23, 59, 59, 999);

  if (period === 'day') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    return { start, end };
  }

  if (period === 'week') {
    const start = new Date(now);
    start.setHours(0, 0, 0, 0);
    const day = start.getDay();
    start.setDate(start.getDate() - (day === 0 ? 6 : day - 1));
    return { start, end };
  }

  if (period === 'month') return { start: new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0), end };
  if (period === 'year') return { start: new Date(now.getFullYear(), 0, 1, 0, 0, 0, 0), end };

  return { start: undefined, end: undefined };
};

const numberOrNull = (value: string): number | null => {
  if (value.trim() === '') return null;
  const n = Number(value.replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

const inRange = (value: number, min: string, max: string) => {
  const minValue = numberOrNull(min);
  const maxValue = numberOrNull(max);
  if (minValue !== null && value < minValue) return false;
  if (maxValue !== null && value > maxValue) return false;
  return true;
};

const sortRows = <T,>(data: T[], field: string, direction: SortDirection, getter: (row: T, field: string) => number) => {
  if (!field) return data;
  return [...data].sort((a, b) => {
    const av = getter(a, field);
    const bv = getter(b, field);
    return direction === 'asc' ? av - bv : bv - av;
  });
};

// ============================================================
// МОДАЛКА СЕБЕСТОИМОСТИ
// ============================================================

const ProductCostModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  product: ProductCostData | null;
}> = ({ isOpen, onClose, product }) => {
  if (!product) return null;

  const breakdown = Array.isArray(product.breakdown) ? product.breakdown : [];
  const pieData = breakdown.map((item, idx) => ({
    name: item?.name || 'Прочие затраты',
    value: Number(item?.amount) || 0,
    color: COLORS[idx % COLORS.length]
  }));

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Себестоимость: ${product.productName}`} size="lg">
      <div className="space-y-6">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            ['Продано', `${product.quantitySold} шт.`, 'text-gray-900 dark:text-white'],
            ['Выручка', formatPrice(product.totalRevenue), 'text-green-600'],
            ['Себестоимость', formatPrice(product.totalCost), 'text-orange-600'],
            ['Прибыль', formatPrice(product.totalProfit), 'text-purple-600']
          ].map(([label, value, color]) => (
            <div key={label} className="bg-gray-50 dark:bg-dark-800 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
              <p className={`text-xl font-bold ${color}`}>{value}</p>
            </div>
          ))}
        </div>

        {pieData.length > 0 ? (
          <div>
            <h4 className="font-medium text-gray-900 dark:text-white mb-3 flex items-center gap-2">
              <Calculator size={16} className="text-primary-600" /> Структура себестоимости
            </h4>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={90}
                      label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine>
                      {pieData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                    </Pie>
                    <Tooltip formatter={(value) => formatPrice(value as number)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              <div className="space-y-2 overflow-y-auto max-h-80">
                {breakdown.map((item, idx) => (
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
        ) : (
          <div className="text-center py-8 text-gray-500">
            <Calculator size={48} className="mx-auto mb-3 opacity-50" />
            <p>Нет данных о структуре себестоимости для этого товара</p>
          </div>
        )}
      </div>
    </Modal>
  );
};

// ============================================================
// ГРАФИКИ СЕБЕСТОИМОСТИ
// ============================================================

const CostChart: React.FC<{ productsCostData: ProductCostData[] }> = ({ productsCostData }) => {
  const [chartType, setChartType] = useState<'bar' | 'pie'>('bar');
  const topByCost = [...productsCostData].sort((a, b) => b.totalCost - a.totalCost).slice(0, 10);
  const pieData = productsCostData.filter(p => p.totalCost > 0).map((p, idx) => ({
    name: p.productName.length > 25 ? `${p.productName.slice(0, 22)}...` : p.productName,
    value: p.totalCost,
    color: COLORS[idx % COLORS.length]
  }));

  if (!productsCostData.length) {
    return <div className="text-center py-8 text-gray-500"><Calculator size={48} className="mx-auto mb-3 opacity-50" /><p>Нет данных о себестоимости</p></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center">
        <h3 className="font-medium text-gray-900 dark:text-white">Себестоимость товаров текущей страницы</h3>
        <div className="flex gap-2">
          <Button variant={chartType === 'bar' ? 'primary' : 'secondary'} size="sm" onClick={() => setChartType('bar')}>Столбцы</Button>
          <Button variant={chartType === 'pie' ? 'primary' : 'secondary'} size="sm" onClick={() => setChartType('pie')}>Круговая</Button>
        </div>
      </div>

      <div className="h-96">
        {chartType === 'bar' ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={topByCost} layout="vertical" margin={{ left: 140, right: 20, top: 20, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis type="number" tickFormatter={formatPrice} />
              <YAxis type="category" dataKey="productName" width={140} tick={{ fontSize: 11 }} interval={0} />
              <Tooltip formatter={(value) => formatPrice(value as number)} />
              <Bar dataKey="totalCost" fill="#f59e0b" name="Себестоимость" />
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={pieData.slice(0, 10)} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine>
                {pieData.slice(0, 10).map((entry, index) => <Cell key={index} fill={entry.color} />)}
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

const WorkTypeCostChart: React.FC<{ workTypeData: CostBreakdownItem[] }> = ({ workTypeData }) => {
  if (!workTypeData.length) {
    return (
      <div className="text-center py-8 text-gray-500">
        <Wrench size={48} className="mx-auto mb-3 opacity-50" />
        <p>Нет данных о затратах по видам работ</p>
      </div>
    );
  }

  const data = workTypeData.map(item => ({ ...item, name: item.name.length > 20 ? `${item.name.slice(0, 17)}...` : item.name }));

  return (
    <div className="space-y-4">
      <h3 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
        <Wrench size={16} className="text-primary-600" /> Затраты по видам работ
      </h3>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="h-96">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie data={data} dataKey="amount" nameKey="name" cx="50%" cy="50%" outerRadius={110}
                label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`} labelLine>
                {data.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
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
              <span className="text-sm font-medium text-gray-900 dark:text-white">{formatPrice(item.amount)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ВЕРХНИЕ ГЛОБАЛЬНЫЕ ФИЛЬТРЫ
// ============================================================

const AnalyticsFiltersComponent: React.FC<{
  filters: AnalyticsFilters;
  onFilterChange: (key: keyof AnalyticsFilters, value: Product | Client | string | null) => void;
  onReset: () => void;
}> = ({ filters, onFilterChange, onReset }) => {
  const [productSearch, setProductSearch] = useState(filters.product?.name || '');
  const [clientSearch, setClientSearch] = useState(() => filters.client
    ? [filters.client.lastName, filters.client.firstName, filters.client.middleName].filter(Boolean).join(' ')
    : '');
  const [citySearch, setCitySearch] = useState(filters.city || '');
  const [showProductDropdown, setShowProductDropdown] = useState(false);
  const [showClientDropdown, setShowClientDropdown] = useState(false);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [filteredClients, setFilteredClients] = useState<Client[]>([]);
  const productSearchRef = useRef<HTMLDivElement>(null);
  const clientSearchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (event: MouseEvent) => {
      if (productSearchRef.current && !productSearchRef.current.contains(event.target as Node)) setShowProductDropdown(false);
      if (clientSearchRef.current && !clientSearchRef.current.contains(event.target as Node)) setShowClientDropdown(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      productsApi.getAll({ search: productSearch, page: 1, limit: 20 })
        .then(r => active && setFilteredProducts(r.data))
        .catch(() => active && setFilteredProducts([]));
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [productSearch]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      clientsApi.getAll({ search: clientSearch, page: 1, limit: 20 })
        .then(r => {
          if (!active) return;
          const data: any = r.data;
          setFilteredClients(Array.isArray(data) ? data : data?.data || data?.clients || []);
        })
        .catch(() => active && setFilteredClients([]));
    }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [clientSearch]);

  const reset = () => {
    onReset();
    setProductSearch('');
    setClientSearch('');
    setCitySearch('');
  };

  return (
    <div className="bg-white dark:bg-dark-800 rounded-xl shadow-sm border border-gray-200 dark:border-dark-700 p-4 mb-6">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Filter size={18} className="text-gray-500" />
          <h3 className="font-medium text-gray-900 dark:text-white">Фильтры аналитики</h3>
        </div>
        <Button size="sm" variant="ghost" onClick={reset}>Сбросить все</Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div ref={productSearchRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Товар</label>
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={productSearch} onChange={e => {
              setProductSearch(e.target.value);
              setShowProductDropdown(true);
              if (filters.product) onFilterChange('product', null);
            }} onFocus={() => setShowProductDropdown(true)} placeholder="Поиск товара..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg" />
          </div>

          {showProductDropdown && filteredProducts.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-dark-800 border dark:border-dark-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredProducts.map(product => (
                <div key={product.id} onClick={() => {
                  onFilterChange('product', product);
                  setProductSearch(product.name);
                  setShowProductDropdown(false);
                }} className="p-2 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer border-b last:border-0 text-sm">
                  <div className="font-medium text-gray-900 dark:text-white">{product.name}</div>
                  <div className="text-xs text-gray-500">Арт: {product.article}</div>
                </div>
              ))}
            </div>
          )}

          {filters.product && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 px-2 py-1 rounded-full">
              {filters.product.name}
              <button onClick={() => { onFilterChange('product', null); setProductSearch(''); }}><X size={12} /></button>
            </div>
          )}
        </div>

        <div ref={clientSearchRef} className="relative">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Покупатель</label>
          <div className="relative">
            <Users size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={clientSearch} onChange={e => {
              setClientSearch(e.target.value);
              setShowClientDropdown(true);
              if (filters.client) onFilterChange('client', null);
            }} onFocus={() => setShowClientDropdown(true)} placeholder="Поиск клиента..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg" />
          </div>

          {showClientDropdown && filteredClients.length > 0 && (
            <div className="absolute z-20 w-full mt-1 bg-white dark:bg-dark-800 border dark:border-dark-700 rounded-lg shadow-lg max-h-60 overflow-y-auto">
              {filteredClients.map(client => {
                const name = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || client.firstName;
                return (
                  <div key={client.id} onClick={() => {
                    onFilterChange('client', client);
                    setClientSearch(name);
                    setShowClientDropdown(false);
                  }} className="p-2 hover:bg-gray-50 dark:hover:bg-dark-700 cursor-pointer border-b last:border-0 text-sm">
                    <div className="font-medium text-gray-900 dark:text-white">{name}</div>
                    <div className="text-xs text-gray-500">{client.phone}</div>
                  </div>
                );
              })}
            </div>
          )}

          {filters.client && (
            <div className="mt-1 inline-flex items-center gap-1 text-xs bg-primary-50 dark:bg-primary-900/30 text-primary-700 px-2 py-1 rounded-full">
              {[filters.client.lastName, filters.client.firstName].filter(Boolean).join(' ')}
              <button onClick={() => { onFilterChange('client', null); setClientSearch(''); }}><X size={12} /></button>
            </div>
          )}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">Город</label>
          <div className="relative">
            <MapPin size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input value={citySearch} onChange={e => {
              setCitySearch(e.target.value);
              onFilterChange('city', e.target.value || null);
            }} placeholder="Введите город..."
              className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg" />
          </div>
        </div>
      </div>
    </div>
  );
};

// ============================================================
// ФИЛЬТРЫ ВНУТРИ ВКЛАДОК
// ============================================================

const RangeInput: React.FC<{
  label: string;
  min: string;
  max: string;
  onMin: (value: string) => void;
  onMax: (value: string) => void;
}> = ({ label, min, max, onMin, onMax }) => (
  <div>
    <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">{label}</label>
    <div className="flex gap-1">
      <input type="number" min="0" value={min} onChange={e => onMin(e.target.value)} placeholder="От"
        className="w-24 px-2 py-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg" />
      <input type="number" min="0" value={max} onChange={e => onMax(e.target.value)} placeholder="До"
        className="w-24 px-2 py-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg" />
    </div>
  </div>
);

const TabFilters: React.FC<{
  tab: AnalyticsTab;
  value: TableFilters;
  onChange: (next: TableFilters) => void;
}> = ({ tab, value, onChange }) => {
  if (tab === 'overview') return null;

  const set = (key: keyof TableFilters, next: string) => onChange({ ...value, [key]: next });

  const sortOptions =
    tab === 'products' ? [
      ['quantity', 'Количество'], ['revenue', 'Выручка'], ['cost', 'Себестоимость'], ['profit', 'Прибыль'], ['margin', 'Рентабельность']
    ] :
    tab === 'clients' ? [
      ['quantity', 'Количество заказов'], ['revenue', 'Выручка'], ['profit', 'Прибыль'], ['average', 'Средний чек']
    ] :
    tab === 'cities' ? [
      ['quantity', 'Количество заказов'], ['revenue', 'Выручка'], ['profit', 'Прибыль'], ['average', 'Средний чек']
    ] : [
      ['quantity', 'Продано'], ['revenue', 'Выручка'], ['cost', 'Себестоимость'], ['profit', 'Прибыль'], ['margin', 'Маржинальность']
    ];

  return (
    <Card>
      <CardBody className="p-4">
        <div className="flex flex-col xl:flex-row xl:items-end gap-4">
          <div className="flex items-center gap-2 self-start xl:self-end h-10">
            <Filter size={17} className="text-gray-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">Фильтр</span>
          </div>

          <div className="flex flex-wrap gap-3 flex-1">
            <RangeInput
              label={tab === 'cost' ? 'Продано, шт.' : tab === 'products' ? 'Количество, шт.' : 'Количество заказов'}
              min={value.minQuantity} max={value.maxQuantity}
              onMin={v => set('minQuantity', v)} onMax={v => set('maxQuantity', v)}
            />

            <RangeInput label="Выручка, ₽" min={value.minRevenue} max={value.maxRevenue}
              onMin={v => set('minRevenue', v)} onMax={v => set('maxRevenue', v)} />

            <RangeInput label="Прибыль, ₽" min={value.minProfit} max={value.maxProfit}
              onMin={v => set('minProfit', v)} onMax={v => set('maxProfit', v)} />

            {(tab === 'products' || tab === 'cost') && (
              <RangeInput label="Себестоимость, ₽" min={value.minCost} max={value.maxCost}
                onMin={v => set('minCost', v)} onMax={v => set('maxCost', v)} />
            )}

            {(tab === 'clients' || tab === 'cities') && (
              <RangeInput label="Средний чек, ₽" min={value.minAverage} max={value.maxAverage}
                onMin={v => set('minAverage', v)} onMax={v => set('maxAverage', v)} />
            )}

            {(tab === 'products' || tab === 'cost') && (
              <RangeInput label="Маржа, %" min={value.minMargin} max={value.maxMargin}
                onMin={v => set('minMargin', v)} onMax={v => set('maxMargin', v)} />
            )}

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Сортировать</label>
              <select value={value.sortBy} onChange={e => set('sortBy', e.target.value)}
                className="h-[38px] px-3 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg">
                <option value="">Без сортировки</option>
                {sortOptions.map(([key, label]) => <option key={key} value={key}>{label}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-medium text-gray-500 dark:text-gray-400 mb-1">Порядок</label>
              <button type="button" onClick={() => onChange({ ...value, sortDirection: value.sortDirection === 'desc' ? 'asc' : 'desc' })}
                className="h-[38px] px-3 flex items-center gap-2 text-sm border border-gray-200 dark:border-dark-700 dark:bg-dark-900 dark:text-white rounded-lg">
                <ArrowUpDown size={15} />
                {value.sortDirection === 'desc' ? 'По убыванию' : 'По возрастанию'}
              </button>
            </div>
          </div>

          <Button variant="secondary" size="sm" onClick={() => onChange({ ...EMPTY_TABLE_FILTERS })}>Сбросить</Button>
        </div>
      </CardBody>
    </Card>
  );
};

// ============================================================
// REPORTS
// ============================================================

interface FormattedSale extends SaleDocument {
  totalProfit: number;
  totalCost: number;
  customerCity: string;
}

export const Reports: React.FC = () => {
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState(false);
  const [rows, setRows] = useState<any[]>([]);
  const [page, setPage] = useState(1);
  const [revision, setRevision] = useState(0);
  const [rowCount, setRowCount] = useState(0);
  const [chartData, setChartData] = useState<any[]>([]);
  const requestVersion = useRef(0);

  const [stats, setStats] = useState<ReportSummary>({
    totalOrders: 0, totalRevenue: 0, totalProfit: 0, totalCost: 0,
    averageCheck: 0, margin: 0, unpaidCount: 0, unpaidAmount: 0
  });

  const [period, setPeriod] = useState<ReportPeriod>('month');
  const initialMonthStart = () => {
    const now = new Date();
    return toDateInputValue(new Date(now.getFullYear(), now.getMonth(), 1));
  };

  const [startDate, setStartDate] = useState(initialMonthStart);
  const [endDate, setEndDate] = useState(() => toDateInputValue(new Date()));
  const [draftStartDate, setDraftStartDate] = useState(initialMonthStart);
  const [draftEndDate, setDraftEndDate] = useState(() => toDateInputValue(new Date()));
  const [showCustom, setShowCustom] = useState(false);
  const [chartType, setChartType] = useState<'line' | 'bar'>('line');
  const [activeTab, setActiveTab] = useState<AnalyticsTab>('overview');

  const [filters, setFilters] = useState<AnalyticsFilters>({ product: null, client: null, city: null });
  const [tableFilters, setTableFilters] = useState<Record<Exclude<AnalyticsTab, 'overview'>, TableFilters>>({
    products: { ...EMPTY_TABLE_FILTERS },
    clients: { ...EMPTY_TABLE_FILTERS },
    cities: { ...EMPTY_TABLE_FILTERS },
    cost: { ...EMPTY_TABLE_FILTERS }
  });

  const [selectedProductCost, setSelectedProductCost] = useState<ProductCostData | null>(null);
  const [isCostModalOpen, setIsCostModalOpen] = useState(false);

  const handlePresetPeriod = (next: 'day' | 'week' | 'month' | 'year') => {
    setPeriod(next);
    setShowCustom(false);
    setPage(1);
  };

  const handleOpenCustomPeriod = () => {
    setDraftStartDate(startDate || initialMonthStart());
    setDraftEndDate(endDate || toDateInputValue(new Date()));
    setShowCustom(true);
  };

  const handleApplyCustomPeriod = () => {
    const from = parseDateInputValue(draftStartDate);
    const to = parseDateInputValue(draftEndDate);

    if (!from || !to) return toast.error('Укажите корректные даты');
    if (from > to) return toast.error('Дата начала не может быть позже даты окончания');

    const today = new Date();
    today.setHours(23, 59, 59, 999);
    if (from > today || to > today) return toast.error('Нельзя выбрать дату в будущем');

    setStartDate(draftStartDate);
    setEndDate(draftEndDate);
    setPeriod('custom');
    setPage(1);
    setRevision(v => v + 1);
  };

  const queryParams = useMemo(() => {
    let from: Date | undefined;
    let to: Date | undefined;

    if (period === 'custom') {
      const a = parseDateInputValue(startDate);
      const b = parseDateInputValue(endDate);
      if (a && b) {
        from = a;
        from.setHours(0, 0, 0, 0);
        to = b;
        to.setHours(23, 59, 59, 999);
      }
    } else if (period !== 'all') {
      const range = getPresetDateRange(period);
      from = range.start;
      to = range.end;
    }

    return {
      startDate: from?.toISOString(),
      endDate: to?.toISOString(),
      productId: filters.product?.id,
      clientId: filters.client?.id,
      city: filters.city || undefined
    };
  }, [period, startDate, endDate, filters]);

  useEffect(() => setPage(1), [queryParams, activeTab]);

  useEffect(() => {
    const version = ++requestVersion.current;
    setLoading(true);
    setLoadError(false);

    reportsApi.getAnalytics({ ...queryParams, tab: activeTab, page, limit: 50 })
      .then(result => {
        if (version !== requestVersion.current) return;
        setRows(result.rows);
        setRowCount(result.total);
        setStats(result.stats);
        setChartData(result.chart.map(row => ({
          ...row,
          date: new Date(row.day).toLocaleDateString('ru-RU')
        })));
      })
      .catch(() => {
        if (version === requestVersion.current) {
          setLoadError(true);
          toast.error('Ошибка загрузки аналитики');
        }
      })
      .finally(() => {
        if (version === requestVersion.current) setLoading(false);
      });

    return () => { requestVersion.current++; };
  }, [queryParams, activeTab, page, revision]);

  const orders: FormattedSale[] = activeTab === 'overview'
    ? rows.map(row => ({
        ...row,
        documentType: row.documentType === 'receipt' ? 'Чек' : row.documentType === 'invoice' ? 'Счёт' : 'Заказ'
      }))
    : [];

  const rawProductStats: any[] = activeTab === 'products' ? rows : [];
  const rawClientStats: any[] = activeTab === 'clients' ? rows : [];
  const rawCityStats: any[] = activeTab === 'cities' ? rows : [];
  const rawProductsCostData: ProductCostData[] = activeTab === 'cost' ? rows : [];

  // ============================================================
  // ФИЛЬТРАЦИЯ ТЕКУЩЕЙ ВКЛАДКИ
  // Сейчас применяется к загруженным строкам текущей страницы.
  // ============================================================

  const productStats = useMemo(() => {
    const f = tableFilters.products;
    const filtered = rawProductStats.filter(p => {
      const quantity = Number(p.quantity) || 0;
      const revenue = Number(p.revenue) || 0;
      const cost = Number(p.cost) || 0;
      const profit = Number(p.profit) || 0;
      const margin = revenue > 0 ? profit / revenue * 100 : 0;

      return inRange(quantity, f.minQuantity, f.maxQuantity)
        && inRange(revenue, f.minRevenue, f.maxRevenue)
        && inRange(cost, f.minCost, f.maxCost)
        && inRange(profit, f.minProfit, f.maxProfit)
        && inRange(margin, f.minMargin, f.maxMargin);
    });

    return sortRows(filtered, f.sortBy, f.sortDirection, (p, field) => {
      const revenue = Number(p.revenue) || 0;
      const profit = Number(p.profit) || 0;
      if (field === 'quantity') return Number(p.quantity) || 0;
      if (field === 'revenue') return revenue;
      if (field === 'cost') return Number(p.cost) || 0;
      if (field === 'profit') return profit;
      if (field === 'margin') return revenue > 0 ? profit / revenue * 100 : 0;
      return 0;
    });
  }, [rawProductStats, tableFilters.products]);

  const clientStats = useMemo(() => {
    const f = tableFilters.clients;
    const filtered = rawClientStats.filter(c => {
      const quantity = Number(c.orders) || 0;
      const revenue = Number(c.revenue) || 0;
      const profit = Number(c.profit) || 0;
      const average = quantity > 0 ? revenue / quantity : 0;

      return inRange(quantity, f.minQuantity, f.maxQuantity)
        && inRange(revenue, f.minRevenue, f.maxRevenue)
        && inRange(profit, f.minProfit, f.maxProfit)
        && inRange(average, f.minAverage, f.maxAverage);
    });

    return sortRows(filtered, f.sortBy, f.sortDirection, (c, field) => {
      const quantity = Number(c.orders) || 0;
      const revenue = Number(c.revenue) || 0;
      if (field === 'quantity') return quantity;
      if (field === 'revenue') return revenue;
      if (field === 'profit') return Number(c.profit) || 0;
      if (field === 'average') return quantity > 0 ? revenue / quantity : 0;
      return 0;
    });
  }, [rawClientStats, tableFilters.clients]);

  const cityStats = useMemo(() => {
    const f = tableFilters.cities;
    const filtered = rawCityStats.filter(c => {
      const quantity = Number(c.orders) || 0;
      const revenue = Number(c.revenue) || 0;
      const profit = Number(c.profit) || 0;
      const average = quantity > 0 ? revenue / quantity : 0;

      return inRange(quantity, f.minQuantity, f.maxQuantity)
        && inRange(revenue, f.minRevenue, f.maxRevenue)
        && inRange(profit, f.minProfit, f.maxProfit)
        && inRange(average, f.minAverage, f.maxAverage);
    });

    return sortRows(filtered, f.sortBy, f.sortDirection, (c, field) => {
      const quantity = Number(c.orders) || 0;
      const revenue = Number(c.revenue) || 0;
      if (field === 'quantity') return quantity;
      if (field === 'revenue') return revenue;
      if (field === 'profit') return Number(c.profit) || 0;
      if (field === 'average') return quantity > 0 ? revenue / quantity : 0;
      return 0;
    });
  }, [rawCityStats, tableFilters.cities]);

  const productsCostData = useMemo(() => {
    const f = tableFilters.cost;

    const filtered = rawProductsCostData.filter(p => {
      const quantity = Number(p.quantitySold) || 0;
      const revenue = Number(p.totalRevenue) || 0;
      const cost = Number(p.totalCost) || 0;
      const profit = Number(p.totalProfit) || 0;
      const margin = revenue > 0 ? profit / revenue * 100 : 0;

      return inRange(quantity, f.minQuantity, f.maxQuantity)
        && inRange(revenue, f.minRevenue, f.maxRevenue)
        && inRange(cost, f.minCost, f.maxCost)
        && inRange(profit, f.minProfit, f.maxProfit)
        && inRange(margin, f.minMargin, f.maxMargin);
    });

    return sortRows(filtered, f.sortBy, f.sortDirection, (p, field) => {
      const revenue = Number(p.totalRevenue) || 0;
      const profit = Number(p.totalProfit) || 0;
      if (field === 'quantity') return Number(p.quantitySold) || 0;
      if (field === 'revenue') return revenue;
      if (field === 'cost') return Number(p.totalCost) || 0;
      if (field === 'profit') return profit;
      if (field === 'margin') return revenue > 0 ? profit / revenue * 100 : 0;
      return 0;
    });
  }, [rawProductsCostData, tableFilters.cost]);

  const workTypeData = useMemo(() => {
    const totals = new Map<string, number>();

    productsCostData.forEach(product => {
      if (!Array.isArray(product.breakdown)) return;

      product.breakdown.forEach(item => {
        if (!item) return;
        const name = typeof item.name === 'string' && item.name.trim() ? item.name.trim() : 'Прочие затраты';
        const amount = Number(item.amount) || 0;
        totals.set(name, (totals.get(name) || 0) + amount);
      });
    });

    return Array.from(totals.entries())
      .map(([name, amount]) => ({ name, amount }))
      .sort((a, b) => b.amount - a.amount);
  }, [productsCostData]);

  const handleFilterChange = (key: keyof AnalyticsFilters, value: Product | Client | string | null) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const resetFilters = () => setFilters({ product: null, client: null, city: null });

  const handleProductClick = (product: ProductCostData) => {
    setSelectedProductCost(product);
    setIsCostModalOpen(true);
  };

  const activeTableFilters = activeTab === 'overview' ? null : tableFilters[activeTab];

  const updateActiveTableFilters = (next: TableFilters) => {
    if (activeTab === 'overview') return;
    setTableFilters(prev => ({ ...prev, [activeTab]: next }));
  };

  // ============================================================
  // EXCEL
  // ============================================================

  const exportToExcel = () => {
    let exportData: Record<string, unknown>[] = [];

    if (activeTab === 'overview') {
      exportData = orders.map(order => ({
        Тип: order.documentType,
        'Номер документа': order.documentNumber,
        Дата: formatDate(order.saleDate),
        Покупатель: order.customerName || '-',
        Телефон: order.customerPhone || '-',
        Город: order.customerCity || '-',
        Сумма: order.subtotal || 0,
        Скидка: order.discount || 0,
        Итого: order.total || 0,
        Себестоимость: order.totalCost || 0,
        Прибыль: order.totalProfit || 0,
        Состав: order.items?.map(i => `${i.productName} x${i.quantity}`).join('; ') || '-'
      }));
    } else if (activeTab === 'products') {
      exportData = productStats.map(p => ({
        Товар: p.name,
        'Количество продаж': p.quantity,
        Выручка: p.revenue,
        Себестоимость: p.cost,
        Прибыль: p.profit,
        Рентабельность: p.revenue > 0 ? `${(p.profit / p.revenue * 100).toFixed(1)}%` : '0%'
      }));
    } else if (activeTab === 'clients') {
      exportData = clientStats.map(c => ({
        Клиент: c.name, Телефон: c.phone, Город: c.city,
        'Количество заказов': c.orders, Выручка: c.revenue, Прибыль: c.profit,
        'Средний чек': c.orders > 0 ? c.revenue / c.orders : 0
      }));
    } else if (activeTab === 'cities') {
      exportData = cityStats.map(c => ({
        Город: c.name, 'Количество заказов': c.orders,
        Выручка: c.revenue, Прибыль: c.profit,
        'Средний чек': c.orders > 0 ? c.revenue / c.orders : 0
      }));
    } else {
      exportData = productsCostData.map(p => ({
        Товар: p.productName, 'Продано шт.': p.quantitySold,
        Выручка: p.totalRevenue, Себестоимость: p.totalCost, Прибыль: p.totalProfit,
        Маржинальность: p.totalRevenue > 0 ? `${(p.totalProfit / p.totalRevenue * 100).toFixed(1)}%` : '0%',
        'Состав себестоимости': (Array.isArray(p.breakdown) ? p.breakdown : []).map(b => `${b.name}: ${b.amount}`).join('; ')
      }));
    }

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, `Отчет_${activeTab}`);
    XLSX.writeFile(wb, `analytics_${activeTab}_${toDateInputValue(new Date())}.xlsx`);
    toast.success('Текущая выборка экспортирована в Excel');
  };

  const metrics = [
    { title: 'Продаж', value: stats.totalOrders, icon: ShoppingBag, bg: 'bg-blue-100 dark:bg-blue-900/30', color: 'text-blue-600 dark:text-blue-400' },
    { title: 'Выручка', value: formatPrice(stats.totalRevenue), icon: DollarSign, bg: 'bg-green-100 dark:bg-green-900/30', color: 'text-green-600 dark:text-green-400' },
    { title: 'Себестоимость', value: formatPrice(stats.totalCost), icon: Package, bg: 'bg-orange-100 dark:bg-orange-900/30', color: 'text-orange-600 dark:text-orange-400' },
    { title: 'Прибыль', value: formatPrice(stats.totalProfit), icon: TrendingUp, bg: 'bg-purple-100 dark:bg-purple-900/30', color: 'text-purple-600 dark:text-purple-400' },
    { title: 'Средний чек', value: formatPrice(stats.averageCheck), icon: Receipt, bg: 'bg-cyan-100 dark:bg-cyan-900/30', color: 'text-cyan-600 dark:text-cyan-400' },
    { title: 'Маржинальность', value: `${stats.margin.toFixed(1)}%`, icon: PieChartIcon,
      bg: stats.margin >= 30 ? 'bg-green-100 dark:bg-green-900/30' : 'bg-yellow-100 dark:bg-yellow-900/30',
      color: stats.margin >= 30 ? 'text-green-600 dark:text-green-400' : 'text-yellow-600 dark:text-yellow-400' }
  ];

  if (loading) {
    return <div className="flex items-center justify-center h-96"><Loader className="animate-spin text-primary-600" size={48} /></div>;
  }

  if (loadError) {
    return <div role="alert">Не удалось загрузить аналитику. Обновите страницу, чтобы повторить запрос.</div>;
  }

  const activeRange = period === 'custom'
    ? { start: parseDateInputValue(startDate) || undefined, end: parseDateInputValue(endDate) || undefined }
    : getPresetDateRange(period);

  const activePeriodLabel = activeRange.start && activeRange.end
    ? `${activeRange.start.toLocaleDateString('ru-RU')} — ${activeRange.end.toLocaleDateString('ru-RU')}`
    : 'За всё время';

  return (
    <div className="space-y-6">
      {/* HEADER */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Аналитика</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">
            Статистика продаж, товаров, покупателей, городов и себестоимости.
          </p>
        </div>
        <Button onClick={exportToExcel} icon={FileSpreadsheet} variant="success">Excel: текущая выборка</Button>
      </div>

      {stats.unpaidCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-400" />
          <p className="text-yellow-800 dark:text-yellow-300 text-sm">
            <strong>Внимание:</strong> в аналитике учитываются только оплаченные заказы.
            В системе {stats.unpaidCount} неоплаченных заказов на сумму {formatPrice(stats.unpaidAmount)}.
          </p>
        </div>
      )}

      {/* ПЕРИОД */}
      <Card>
        <CardBody className="p-5">
          <div className="space-y-4">
            <div className="flex flex-col xl:flex-row xl:items-center xl:justify-between gap-4">
              <div className="flex flex-wrap items-center gap-2">
                <Calendar size={19} className="text-gray-400" />
                <span className="text-sm font-medium text-gray-700 dark:text-gray-300 mr-2">Период</span>

                <Button variant={period === 'day' ? 'primary' : 'secondary'} size="sm" onClick={() => handlePresetPeriod('day')}>Сегодня</Button>
                <Button variant={period === 'week' ? 'primary' : 'secondary'} size="sm" onClick={() => handlePresetPeriod('week')}>Эта неделя</Button>
                <Button variant={period === 'month' ? 'primary' : 'secondary'} size="sm" onClick={() => handlePresetPeriod('month')}>Этот месяц</Button>
                <Button variant={period === 'year' ? 'primary' : 'secondary'} size="sm" onClick={() => handlePresetPeriod('year')}>Этот год</Button>
                <Button variant={period === 'custom' ? 'primary' : 'secondary'} size="sm" onClick={handleOpenCustomPeriod}>Произвольный период</Button>
              </div>

              <div className="text-sm text-gray-500 dark:text-gray-400">
                Сейчас: <span className="font-medium text-gray-900 dark:text-white">{activePeriodLabel}</span>
              </div>
            </div>

            {showCustom && (
              <div className="border-t border-gray-200 dark:border-dark-700 pt-4">
                <div className="flex flex-col lg:flex-row lg:items-end gap-4">
                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Дата начала</label>
                    <input type="date" value={draftStartDate} max={toDateInputValue(new Date())}
                      onChange={e => setDraftStartDate(e.target.value)}
                      className="h-10 px-3 border border-gray-300 dark:border-dark-700 rounded-lg text-sm bg-white dark:bg-dark-900 dark:text-white" />
                  </div>

                  <div>
                    <label className="block text-xs font-medium text-gray-500 mb-1.5">Дата окончания</label>
                    <input type="date" value={draftEndDate} min={draftStartDate || undefined} max={toDateInputValue(new Date())}
                      onChange={e => setDraftEndDate(e.target.value)}
                      className="h-10 px-3 border border-gray-300 dark:border-dark-700 rounded-lg text-sm bg-white dark:bg-dark-900 dark:text-white" />
                  </div>

                  <Button size="sm" onClick={handleApplyCustomPeriod}>Применить период</Button>
                  <Button size="sm" variant="secondary" onClick={() => setShowCustom(false)}>Закрыть</Button>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      <AnalyticsFiltersComponent filters={filters} onFilterChange={handleFilterChange} onReset={resetFilters} />

      {/* МЕТРИКИ */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {metrics.map(metric => (
          <Card key={metric.title} className="p-4">
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

      {/* ВКЛАДКИ */}
      <div className="flex flex-wrap gap-2 border-b border-gray-200 dark:border-dark-700 pb-2">
        {[
          { id: 'overview' as const, label: 'Обзор', icon: BarChart3 },
          { id: 'products' as const, label: 'По товарам', icon: Package },
          { id: 'clients' as const, label: 'По покупателям', icon: Users },
          { id: 'cities' as const, label: 'По городам', icon: MapPin },
          { id: 'cost' as const, label: 'Себестоимость', icon: Calculator }
        ].map(tab => (
          <button key={tab.id} onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
              activeTab === tab.id
                ? 'bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400 border-b-2 border-primary-600'
                : 'text-gray-500 dark:text-gray-400 hover:bg-gray-50 dark:hover:bg-dark-800'
            }`}>
            <tab.icon size={18} />
            <span className="text-sm font-medium">{tab.label}</span>
          </button>
        ))}
      </div>

      {/* ФИЛЬТРЫ ВЫБРАННОЙ ВКЛАДКИ */}
      {activeTableFilters && (
        <TabFilters tab={activeTab} value={activeTableFilters} onChange={updateActiveTableFilters} />
      )}

          {/* ============================================================ */}
      {/* ОБЗОР */}
      {/* ============================================================ */}

      {activeTab === 'overview' && chartData.length > 0 && (
        <Card>
          <CardBody className="p-6">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">
                Динамика продаж
              </h2>

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

            <div className="h-96">
              <ResponsiveContainer width="100%" height="100%">
                {chartType === 'line' ? (
                  <LineChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={value => formatPrice(value)} />
                    <Tooltip
                      formatter={(value, name) => [
                        formatPrice(value as number),
                        name === 'revenue'
                          ? 'Выручка'
                          : name === 'profit'
                            ? 'Прибыль'
                            : name
                      ]}
                    />
                    <Legend
                      formatter={value =>
                        value === 'revenue'
                          ? 'Выручка'
                          : value === 'profit'
                            ? 'Прибыль'
                            : value
                      }
                    />
                    <Line
                      type="monotone"
                      dataKey="revenue"
                      stroke="#10b981"
                      strokeWidth={2}
                      name="revenue"
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                    <Line
                      type="monotone"
                      dataKey="profit"
                      stroke="#8b5cf6"
                      strokeWidth={2}
                      name="profit"
                      dot={false}
                      activeDot={{ r: 5 }}
                    />
                  </LineChart>
                ) : (
                  <BarChart
                    data={chartData}
                    margin={{ top: 20, right: 30, left: 20, bottom: 20 }}
                  >
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="date" tick={{ fontSize: 11 }} />
                    <YAxis tickFormatter={value => formatPrice(value)} />
                    <Tooltip
                      formatter={(value, name) => [
                        formatPrice(value as number),
                        name === 'revenue'
                          ? 'Выручка'
                          : name === 'profit'
                            ? 'Прибыль'
                            : name
                      ]}
                    />
                    <Legend
                      formatter={value =>
                        value === 'revenue'
                          ? 'Выручка'
                          : value === 'profit'
                            ? 'Прибыль'
                            : value
                      }
                    />
                    <Bar dataKey="revenue" fill="#10b981" name="revenue" />
                    <Bar dataKey="profit" fill="#8b5cf6" name="profit" />
                  </BarChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardBody>
        </Card>
      )}

      {activeTab === 'overview' && (
        <Card>
          <CardBody className="p-0">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    {[
                      'Тип',
                      'Номер',
                      'Дата',
                      'Покупатель',
                      'Телефон',
                      'Город',
                      'Состав',
                      'Сумма',
                      'Прибыль'
                    ].map((title, index) => (
                      <th
                        key={title}
                        className={`px-4 py-3 text-xs font-medium text-gray-500 dark:text-gray-400 uppercase ${
                          index >= 7 ? 'text-right' : 'text-left'
                        }`}
                      >
                        {title}
                      </th>
                    ))}
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {orders.length === 0 ? (
                    <tr>
                      <td
                        colSpan={9}
                        className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        За выбранный период продаж нет
                      </td>
                    </tr>
                  ) : (
                    orders.map(order => (
                      <tr
                        key={order.id}
                        className="hover:bg-gray-50 dark:hover:bg-dark-800"
                      >
                        <td className="px-4 py-3 text-sm">
                          <span
                            className={`px-2 py-1 rounded-full text-xs font-medium ${
                              order.documentType === 'Чек'
                                ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                : order.documentType === 'Счёт'
                                  ? 'bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400'
                                  : 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                            }`}
                          >
                            {order.documentType}
                          </span>
                        </td>

                        <td className="px-4 py-3 text-sm font-mono text-primary-600 dark:text-primary-400">
                          {order.documentNumber}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {formatDate(order.saleDate)}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-900 dark:text-white">
                          {order.customerName ||
                            (order.client
                              ? `${order.client.firstName || ''} ${order.client.lastName || ''}`.trim()
                              : '') ||
                            '-'}
                        </td>

                        <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                          {order.customerPhone || order.client?.phone || '-'}
                        </td>

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
                          {order.items
                            ?.map(item => `${item.productName} x${item.quantity}`)
                            .join(', ') || '-'}

                          {(order as any).itemCount > 200 && ' (первые 200 позиций)'}
                        </td>

                        <td className="px-4 py-3 text-sm text-right font-semibold text-gray-900 dark:text-white">
                          {formatPrice(order.total)}
                        </td>

                        <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                          {formatPrice(order.totalProfit)}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ============================================================ */}
      {/* ПО ТОВАРАМ */}
      {/* ============================================================ */}

      {activeTab === 'products' && (
        <Card>
          <CardBody className="p-0">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Товары
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  После фильтра: {productStats.length} из {rawProductStats.length} строк текущей страницы
                </p>
              </div>

              {productStats.length !== rawProductStats.length && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                  Фильтр активен
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Товар
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Количество
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Выручка
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Себестоимость
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Прибыль
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Рентабельность
                    </th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Детали
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {productStats.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        Нет товаров, подходящих под выбранные фильтры
                      </td>
                    </tr>
                  ) : (
                    productStats.map((product, idx) => {
                      const costData = rawProductsCostData.find(
                        p => p.productName === product.name
                      );

                      const revenue = Number(product.revenue) || 0;
                      const profit = Number(product.profit) || 0;
                      const margin = revenue > 0 ? profit / revenue * 100 : 0;

                      return (
                        <tr
                          key={product.id ?? product.productId ?? idx}
                          className="hover:bg-gray-50 dark:hover:bg-dark-800"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {product.name}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {product.quantity} шт.
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                            {formatPrice(revenue)}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                            {formatPrice(Number(product.cost) || 0)}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                            {formatPrice(profit)}
                          </td>

                          <td className="px-4 py-3 text-sm text-right">
                            <span
                              className={`px-2 py-1 rounded-full text-xs font-medium ${
                                margin > 30
                                  ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                  : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                              }`}
                            >
                              {margin.toFixed(1)}%
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-center">
                            {costData &&
                              Array.isArray(costData.breakdown) &&
                              costData.breakdown.length > 0 && (
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
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ============================================================ */}
      {/* ПО ПОКУПАТЕЛЯМ */}
      {/* ============================================================ */}

      {activeTab === 'clients' && (
        <Card>
          <CardBody className="p-0">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Покупатели
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  После фильтра: {clientStats.length} из {rawClientStats.length} строк текущей страницы
                </p>
              </div>

              {clientStats.length !== rawClientStats.length && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                  Фильтр активен
                </span>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Клиент
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Телефон
                    </th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Город
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Заказов
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Выручка
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Прибыль
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Средний чек
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {clientStats.length === 0 ? (
                    <tr>
                      <td
                        colSpan={7}
                        className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        Нет покупателей, подходящих под выбранные фильтры
                      </td>
                    </tr>
                  ) : (
                    clientStats.map((client, idx) => {
                      const ordersCount = Number(client.orders) || 0;
                      const revenue = Number(client.revenue) || 0;
                      const average = ordersCount > 0 ? revenue / ordersCount : 0;

                      return (
                        <tr
                          key={client.id ?? client.clientId ?? idx}
                          className="hover:bg-gray-50 dark:hover:bg-dark-800"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            {client.name}
                          </td>

                          <td className="px-4 py-3 text-sm text-gray-500 dark:text-gray-400">
                            {client.phone || '-'}
                          </td>

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

                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {ordersCount}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                            {formatPrice(revenue)}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                            {formatPrice(Number(client.profit) || 0)}
                          </td>

                          <td className="px-4 py-3 text-sm text-right font-medium text-gray-900 dark:text-white">
                            {formatPrice(average)}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ============================================================ */}
      {/* ПО ГОРОДАМ */}
      {/* ============================================================ */}

      {activeTab === 'cities' && (
        <Card>
          <CardBody className="p-0">
            <div className="px-4 py-3 border-b border-gray-200 dark:border-dark-700 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-gray-900 dark:text-white">
                  Города
                </p>
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  После фильтра: {cityStats.length} из {rawCityStats.length} строк текущей страницы
                </p>
              </div>

              {cityStats.length !== rawCityStats.length && (
                <span className="text-xs px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                  Фильтр активен
                </span>
              )}
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 p-6 border-b border-gray-200 dark:border-dark-700">
              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Выручка по городам
                </h3>

                {cityStats.filter(city => city.name !== 'Не указан').length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <PieChart margin={{ top: 20, bottom: 20, left: 20, right: 20 }}>
                      <Pie
                        data={cityStats
                          .filter(city => city.name !== 'Не указан')
                          .slice(0, 8)}
                        dataKey="revenue"
                        nameKey="name"
                        cx="50%"
                        cy="50%"
                        outerRadius={120}
                        label={({ name, percent }) =>
                          `${name}: ${(percent * 100).toFixed(0)}%`
                        }
                        labelLine
                      >
                        {cityStats
                          .filter(city => city.name !== 'Не указан')
                          .slice(0, 8)
                          .map((_, index) => (
                            <Cell
                              key={index}
                              fill={COLORS[index % COLORS.length]}
                            />
                          ))}
                      </Pie>

                      <Tooltip formatter={value => formatPrice(value as number)} />
                      <Legend
                        layout="vertical"
                        align="right"
                        verticalAlign="middle"
                        wrapperStyle={{ fontSize: '12px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-gray-500">
                    Нет данных о городах
                  </div>
                )}
              </div>

              <div>
                <h3 className="font-medium text-gray-900 dark:text-white mb-4">
                  Количество заказов по городам
                </h3>

                {cityStats.length > 0 ? (
                  <ResponsiveContainer width="100%" height={400}>
                    <BarChart data={cityStats.slice(0, 10)} margin={{ bottom: 60 }}>
                      <CartesianGrid strokeDasharray="3 3" />
                      <XAxis
                        dataKey="name"
                        angle={-45}
                        textAnchor="end"
                        height={80}
                        interval={0}
                        tick={{ fontSize: 11 }}
                      />
                      <YAxis />
                      <Tooltip />
                      <Bar dataKey="orders" fill="#10b981" name="Заказов" />
                    </BarChart>
                  </ResponsiveContainer>
                ) : (
                  <div className="h-[400px] flex items-center justify-center text-gray-500">
                    Нет данных о городах
                  </div>
                )}
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Город
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Заказов
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Выручка
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Прибыль
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Средний чек
                    </th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                      Доля
                    </th>
                  </tr>
                </thead>

                <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                  {cityStats.length === 0 ? (
                    <tr>
                      <td
                        colSpan={6}
                        className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                      >
                        Нет городов, подходящих под выбранные фильтры
                      </td>
                    </tr>
                  ) : (
                    cityStats.map((city, idx) => {
                      const ordersCount = Number(city.orders) || 0;
                      const revenue = Number(city.revenue) || 0;
                      const average = ordersCount > 0 ? revenue / ordersCount : 0;

                      return (
                        <tr
                          key={city.id ?? city.name ?? idx}
                          className="hover:bg-gray-50 dark:hover:bg-dark-800"
                        >
                          <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                            <span className="flex items-center gap-2">
                              <MapPin size={14} className="text-gray-400" />
                              {city.name}
                            </span>
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {ordersCount}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                            {formatPrice(revenue)}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                            {formatPrice(Number(city.profit) || 0)}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {formatPrice(average)}
                          </td>

                          <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                            {stats.totalRevenue > 0
                              ? `${(revenue / stats.totalRevenue * 100).toFixed(1)}%`
                              : '0%'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </CardBody>
        </Card>
      )}

      {/* ============================================================ */}
      {/* СЕБЕСТОИМОСТЬ */}
      {/* ============================================================ */}

      {activeTab === 'cost' && (
        <div className="space-y-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                Аналитика себестоимости
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400">
                После фильтра: {productsCostData.length} из {rawProductsCostData.length} строк текущей страницы
              </p>
            </div>

            {productsCostData.length !== rawProductsCostData.length && (
              <span className="text-xs px-2 py-1 rounded-full bg-primary-50 dark:bg-primary-900/30 text-primary-600 dark:text-primary-400">
                Фильтр активен
              </span>
            )}
          </div>

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
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead className="bg-gray-50 dark:bg-dark-800 border-b border-gray-200 dark:border-dark-700">
                    <tr>
                      <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Товар
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Продано
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Выручка
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Себестоимость
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Прибыль
                      </th>
                      <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Маржинальность
                      </th>
                      <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 dark:text-gray-400 uppercase">
                        Состав
                      </th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-gray-200 dark:divide-dark-700">
                    {productsCostData.length === 0 ? (
                      <tr>
                        <td
                          colSpan={7}
                          className="px-4 py-10 text-center text-sm text-gray-500 dark:text-gray-400"
                        >
                          Нет товаров, подходящих под выбранные фильтры
                        </td>
                      </tr>
                    ) : (
                      productsCostData.map((product, idx) => {
                        const revenue = Number(product.totalRevenue) || 0;
                        const profit = Number(product.totalProfit) || 0;
                        const margin = revenue > 0 ? profit / revenue * 100 : 0;

                        return (
                          <tr
                            key={product.productId ?? idx}
                            className="hover:bg-gray-50 dark:hover:bg-dark-800"
                          >
                            <td className="px-4 py-3 text-sm font-medium text-gray-900 dark:text-white">
                              {product.productName}
                            </td>

                            <td className="px-4 py-3 text-sm text-right text-gray-700 dark:text-gray-300">
                              {product.quantitySold} шт.
                            </td>

                            <td className="px-4 py-3 text-sm text-right text-green-600 dark:text-green-400">
                              {formatPrice(revenue)}
                            </td>

                            <td className="px-4 py-3 text-sm text-right text-orange-600 dark:text-orange-400">
                              {formatPrice(Number(product.totalCost) || 0)}
                            </td>

                            <td className="px-4 py-3 text-sm text-right text-purple-600 dark:text-purple-400">
                              {formatPrice(profit)}
                            </td>

                            <td className="px-4 py-3 text-sm text-right">
                              <span
                                className={`px-2 py-1 rounded-full text-xs font-medium ${
                                  margin > 30
                                    ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                                    : 'bg-yellow-100 dark:bg-yellow-900/30 text-yellow-700 dark:text-yellow-400'
                                }`}
                              >
                                {margin.toFixed(1)}%
                              </span>
                            </td>

                            <td className="px-4 py-3 text-sm text-center">
                              {Array.isArray(product.breakdown) &&
                                product.breakdown.length > 0 && (
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
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </CardBody>
          </Card>
        </div>
      )}

      {/* ============================================================ */}
      {/* ПАГИНАЦИЯ */}
      {/* ============================================================ */}

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="text-sm text-gray-500 dark:text-gray-400">
          <span>
            Всего на сервере: <strong>{rowCount}</strong>.
          </span>

          {activeTab !== 'overview' && (
            <span className="ml-2">
              Показано после локального фильтра: <strong>
                {activeTab === 'products'
                  ? productStats.length
                  : activeTab === 'clients'
                    ? clientStats.length
                    : activeTab === 'cities'
                      ? cityStats.length
                      : productsCostData.length}
              </strong>.
            </span>
          )}

          <span className="ml-2">
            Страница <strong>{page}</strong> из{' '}
            <strong>{Math.max(1, Math.ceil(rowCount / 50))}</strong>
          </span>
        </div>

        <div className="flex gap-2">
          <Button
            disabled={page <= 1}
            onClick={() => setPage(value => Math.max(1, value - 1))}
          >
            Назад
          </Button>

          <Button
            disabled={page * 50 >= rowCount}
            onClick={() => setPage(value => value + 1)}
          >
            Далее
          </Button>
        </div>
      </div>

      {/* ============================================================ */}
      {/* МОДАЛКА СЕБЕСТОИМОСТИ */}
      {/* ============================================================ */}

      <ProductCostModal
        isOpen={isCostModalOpen}
        onClose={() => setIsCostModalOpen(false)}
        product={selectedProductCost}
      />
    </div>
  );
};

export default Reports;