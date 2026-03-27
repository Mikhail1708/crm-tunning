// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect } from 'react';
import { reportsApi } from '../api/reports';
import { productsApi } from '../api/products';
import { clientsApi } from '../api/clients';
import { saleDocumentsApi } from '../api/saleDocuments';
import { formatPrice, formatNumber, formatDate } from '../utils/formatters';
import { 
  TrendingUp, 
  ShoppingBag, 
  Package, 
  Receipt,
  AlertCircle,
  Loader,
  DollarSign,
  Users,
  Calendar,
  ArrowRight,
  CheckCircle,
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState({
    totalRevenue: 0,
    totalProfit: 0,
    totalCost: 0,
    margin: 0,
    totalSales: 0,
    totalProducts: 0,
    lowStockCount: 0,
    totalClients: 0,
    totalStock: 0,
    // Добавляем статистику по оплаченным заказам
    paidSales: 0,
    unpaidSales: 0,
    unpaidTotal: 0,
    averageCheck: 0
  });
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [recentClients, setRecentClients] = useState([]);

  useEffect(() => {
    loadDashboardData();
  }, []);

  const loadDashboardData = async () => {
    try {
      setLoading(true);
      
      // Получаем все данные параллельно
      const [summaryRes, profitRes, lowStockRes, clientsRes, salesRes] = await Promise.all([
        reportsApi.getSummary(),
        reportsApi.getProfitByProduct(),
        productsApi.getLowStock(),
        clientsApi.getAll({ limit: 5, sortBy: 'createdAt', sortOrder: 'desc' }),
        saleDocumentsApi.getAll()
      ]);
      
      console.log('=== DASHBOARD DATA ===');
      console.log('Summary:', summaryRes.data);
      console.log('Products:', profitRes.data);
      console.log('Low stock:', lowStockRes.data);
      console.log('Clients:', clientsRes.data);
      console.log('Sales:', salesRes.data);
      
      // Парсим данные из summary
      const summaryData = summaryRes.data || {};
      const total = summaryData.total || { revenue: 0, cost: 0, profit: 0 };
      const products = summaryData.products || { total: 0, low_stock: 0 };
      const topProductsList = summaryData.top_products || [];
      
      // Получаем все заказы
      const allSales = salesRes.data || [];
      
      // Разделяем на оплаченные и неоплаченные
      const paidSales = allSales.filter(sale => sale.paymentStatus === 'paid' || sale.paymentStatus === 'PAID');
      const unpaidSales = allSales.filter(sale => sale.paymentStatus !== 'paid' && sale.paymentStatus !== 'PAID');
      
      // Рассчитываем статистику ТОЛЬКО по оплаченным заказам
      const paidRevenue = paidSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
      const paidCost = paidSales.reduce((sum, sale) => {
        // Если есть items, считаем себестоимость по товарам
        if (sale.items && sale.items.length > 0) {
          return sum + sale.items.reduce((itemSum, item) => itemSum + (item.cost_price || 0) * (item.quantity || 0), 0);
        }
        // Иначе используем приблизительную себестоимость (примерно 30% от выручки для демо)
        return sum + (sale.total || 0) * 0.3;
      }, 0);
      const paidProfit = paidRevenue - paidCost;
      const paidMargin = paidRevenue > 0 ? (paidProfit / paidRevenue) * 100 : 0;
      const averageCheck = paidSales.length > 0 ? paidRevenue / paidSales.length : 0;
      
      // Неоплаченные заказы
      const unpaidTotal = unpaidSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
      
      // Подсчет общего количества товаров на складе
      const allProducts = profitRes.data || [];
      const totalStock = allProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
      
      // Получаем клиентов
      const clients = clientsRes.data?.clients || [];
      const totalClients = clientsRes.data?.total || 0;
      
      setSummary({
        // Основные показатели ТОЛЬКО по оплаченным
        totalRevenue: paidRevenue,
        totalProfit: paidProfit,
        totalCost: paidCost,
        margin: paidMargin,
        totalSales: paidSales.length,
        // Общие показатели
        totalProducts: products.total || 0,
        lowStockCount: products.low_stock || 0,
        totalClients: totalClients,
        totalStock: totalStock,
        averageCheck: averageCheck,
        // Дополнительно: неоплаченные
        unpaidSales: unpaidSales.length,
        unpaidTotal: unpaidTotal
      });
      
      setLowStockProducts(lowStockRes.data || []);
      
      // Форматируем популярные товары (топ 5 по продажам - ТОЛЬКО из оплаченных заказов)
      const salesItemsMap = new Map();
      
      paidSales.forEach(sale => {
        if (sale.items && sale.items.length > 0) {
          sale.items.forEach(item => {
            const productId = item.productId;
            if (!salesItemsMap.has(productId)) {
              salesItemsMap.set(productId, {
                id: productId,
                name: item.productName,
                total_sold: 0,
                total_revenue: 0
              });
            }
            const product = salesItemsMap.get(productId);
            product.total_sold += item.quantity || 0;
            product.total_revenue += item.total || 0;
          });
        }
      });
      
      // Добавляем цены из каталога
      const formattedTopProducts = Array.from(salesItemsMap.values())
        .filter(p => p.total_sold > 0)
        .sort((a, b) => b.total_sold - a.total_sold)
        .slice(0, 5)
        .map(product => {
          const catalogProduct = allProducts.find(p => p.id === product.id);
          return {
            id: product.id,
            name: product.name || 'Без названия',
            article: catalogProduct?.article || '—',
            retail_price: catalogProduct?.retail_price || 0,
            total_sold: product.total_sold,
            total_revenue: product.total_revenue,
            profit_margin: catalogProduct?.retail_price && catalogProduct?.cost_price 
              ? ((catalogProduct.retail_price - catalogProduct.cost_price) / catalogProduct.retail_price * 100).toFixed(1)
              : 0
          };
        });
      setTopProducts(formattedTopProducts);
      
      // Последние 5 продаж (все заказы, но с указанием статуса оплаты)
      const recentSalesData = allSales
        .filter(sale => sale.documentType === 'order' || sale.documentType === 'receipt')
        .sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate))
        .slice(0, 5)
        .map(sale => ({
          id: sale.id,
          documentNumber: sale.documentNumber,
          saleDate: sale.saleDate,
          customerName: sale.customerName || sale.clientName || '-',
          total: sale.total || 0,
          documentType: sale.documentType === 'receipt' ? 'Чек' : 'Заказ',
          paymentStatus: sale.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен',
          isPaid: sale.paymentStatus === 'paid'
        }));
      setRecentSales(recentSalesData);
      
      // Последние 5 клиентов
      const recentClientsData = clients.slice(0, 5).map(client => ({
        id: client.id,
        name: [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || client.firstName || 'Без имени',
        phone: client.phone,
        city: client.city,
        createdAt: client.createdAt,
        totalSpent: client.totalSpent || 0
      }));
      setRecentClients(recentClientsData);
      
    } catch (error) {
      console.error('Error loading dashboard:', error);
      toast.error('Ошибка загрузки данных');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  const stats = [
    {
      title: 'Продажи',
      value: formatNumber(summary.totalSales),
      icon: ShoppingBag,
      bg: 'bg-blue-100',
      color: 'text-blue-600',
      description: 'оплаченных заказов',
      tooltip: 'Только оплаченные заказы'
    },
    {
      title: 'Выручка',
      value: formatPrice(summary.totalRevenue),
      icon: DollarSign,
      bg: 'bg-green-100',
      color: 'text-green-600',
      description: 'от оплаченных заказов',
      tooltip: 'Только оплаченные заказы'
    },
    {
      title: 'Прибыль',
      value: formatPrice(summary.totalProfit),
      icon: TrendingUp,
      bg: 'bg-purple-100',
      color: 'text-purple-600',
      description: 'чистая прибыль',
      tooltip: 'Только оплаченные заказы'
    },
    {
      title: 'Клиенты',
      value: formatNumber(summary.totalClients),
      icon: Users,
      bg: 'bg-cyan-100',
      color: 'text-cyan-600',
      description: 'в базе'
    },
    {
      title: 'Товаров на складе',
      value: formatNumber(summary.totalStock),
      icon: Package,
      bg: 'bg-orange-100',
      color: 'text-orange-600',
      description: 'общее количество'
    },
    {
      title: 'Средний чек',
      value: formatPrice(summary.averageCheck),
      icon: Receipt,
      bg: 'bg-yellow-100',
      color: 'text-yellow-600',
      description: 'на оплаченный заказ'
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Дашборд</h1>
        <p className="text-gray-500 mt-1">Обзор состояния бизнеса</p>
      </div>

      {/* Предупреждение о неоплаченных заказах */}
      {summary.unpaidSales > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 rounded-lg">
          <div className="flex items-center">
            <AlertCircle className="text-yellow-400 mr-3" size={20} />
            <div>
              <p className="text-yellow-700 font-medium">
                Внимание: {summary.unpaidSales} неоплаченных заказов на сумму {formatPrice(summary.unpaidTotal)}
              </p>
              <p className="text-yellow-600 text-sm mt-1">
                В статистике дашборда учитываются только оплаченные заказы. Неоплаченные заказы не влияют на выручку и прибыль.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards - 6 карточек */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-shadow group relative">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={20} className={stat.color} />
              </div>
              <span className="text-xs text-gray-400">{stat.description}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.title}</p>
            {stat.tooltip && (
              <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none">
                {stat.tooltip}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Низкий остаток */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <AlertCircle className="text-yellow-500" size={20} />
                <h2 className="text-lg font-semibold text-gray-900">Товары с низким остатком</h2>
              </div>
              {summary.lowStockCount > 0 && (
                <span className="px-2 py-1 text-xs font-medium bg-yellow-100 text-yellow-700 rounded-full">
                  {summary.lowStockCount} товаров
                </span>
              )}
            </div>
          </div>
          <div className="p-5">
            {lowStockProducts.length === 0 ? (
              <div className="text-center py-8">
                <Package size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Все товары в достаточном количестве</p>
                <p className="text-sm text-gray-400 mt-1">Нет товаров, требующих пополнения</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {lowStockProducts.map((product) => (
                  <div key={product.id} className="flex items-center justify-between p-3 bg-yellow-50 rounded-lg">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900">{product.name}</p>
                      <p className="text-xs text-gray-500">Артикул: {product.article}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Остаток</p>
                      <p className="font-bold text-yellow-600">{product.stock} шт.</p>
                      <p className="text-xs text-gray-500">Мин: {product.min_stock} шт.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Популярные товары */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <TrendingUp size={20} className="text-primary-600" />
              <h2 className="text-lg font-semibold text-gray-900">Популярные товары</h2>
              <span className="text-xs text-gray-400 ml-auto">Топ по продажам</span>
            </div>
          </div>
          <div className="p-5">
            {topProducts.length === 0 ? (
              <div className="text-center py-8">
                <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Нет данных о продажах</p>
                <p className="text-sm text-gray-400 mt-1">Добавьте первые продажи</p>
              </div>
            ) : (
              <div className="space-y-3 max-h-80 overflow-y-auto">
                {topProducts.map((product, index) => (
                  <div key={product.id || index} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors">
                    <div className="flex items-center gap-3 flex-1">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-sm ${
                        index === 0 ? 'bg-yellow-100 text-yellow-700' :
                        index === 1 ? 'bg-gray-100 text-gray-600' :
                        index === 2 ? 'bg-orange-100 text-orange-700' :
                        'bg-primary-100 text-primary-600'
                      }`}>
                        {index + 1}
                      </div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                        <p className="text-xs text-gray-500">Продано: {product.total_sold} шт.</p>
                        {product.profit_margin > 0 && (
                          <p className="text-xs text-green-600">Маржинальность: {product.profit_margin}%</p>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <p className="text-sm font-semibold text-gray-900">{formatPrice(product.retail_price)}</p>
                      <p className="text-xs text-green-600">+{formatPrice(product.total_revenue)}</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Последние продажи */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <ShoppingBag size={20} className="text-green-600" />
                <h2 className="text-lg font-semibold text-gray-900">Последние заказы</h2>
              </div>
              <button 
                onClick={() => window.location.href = '/sales'}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                Все заказы <ArrowRight size={12} />
              </button>
            </div>
          </div>
          <div className="p-5">
            {recentSales.length === 0 ? (
              <div className="text-center py-8">
                <Receipt size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Нет заказов</p>
                <p className="text-sm text-gray-400 mt-1">Создайте первый заказ</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentSales.map((sale) => (
                  <div key={sale.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer" 
                       onClick={() => window.location.href = `/sales/${sale.id}`}>
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-medium text-gray-900 text-sm">{sale.documentNumber}</p>
                        <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                          sale.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {sale.isPaid ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {sale.paymentStatus}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          sale.documentType === 'Чек' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                        }`}>
                          {sale.documentType}
                        </span>
                      </div>
                      <p className="text-xs text-gray-500 mt-1">
                        {sale.customerName} • {formatDate(sale.saleDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${sale.isPaid ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatPrice(sale.total)}
                      </p>
                      {!sale.isPaid && (
                        <p className="text-xs text-gray-400">ожидает оплаты</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Новые клиенты */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users size={20} className="text-cyan-600" />
                <h2 className="text-lg font-semibold text-gray-900">Новые клиенты</h2>
              </div>
              <button 
                onClick={() => window.location.href = '/clients'}
                className="text-xs text-primary-600 hover:text-primary-700 flex items-center gap-1"
              >
                Все клиенты <ArrowRight size={12} />
              </button>
            </div>
          </div>
          <div className="p-5">
            {recentClients.length === 0 ? (
              <div className="text-center py-8">
                <Users size={48} className="mx-auto mb-3 text-gray-300" />
                <p className="text-gray-500">Нет клиентов</p>
                <p className="text-sm text-gray-400 mt-1">Добавьте первого клиента</p>
              </div>
            ) : (
              <div className="space-y-3">
                {recentClients.map((client) => (
                  <div key={client.id} className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                       onClick={() => window.location.href = `/clients/${client.id}`}>
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{client.name}</p>
                      <p className="text-xs text-gray-500">{client.phone}</p>
                      {client.city && (
                        <p className="text-xs text-gray-400 mt-0.5">{client.city}</p>
                      )}
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Дата регистрации</p>
                      <p className="text-xs font-medium text-gray-600">{formatDate(client.createdAt)}</p>
                      {client.totalSpent > 0 && (
                        <p className="text-xs text-green-600 mt-1">+{formatPrice(client.totalSpent)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Ключевые показатели */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ключевые показатели</h2>
          <p className="text-xs text-gray-400 mt-1">* Данные только по оплаченным заказам</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">Себестоимость</p>
              <p className="text-xl font-bold text-orange-600">{formatPrice(summary.totalCost)}</p>
              <p className="text-xs text-gray-400 mt-1">общая себестоимость</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">Маржинальность</p>
              <p className={`text-xl font-bold ${summary.margin >= 30 ? 'text-green-600' : 'text-yellow-600'}`}>
                {summary.margin.toFixed(1)}%
              </p>
              <p className="text-xs text-gray-400 mt-1">от выручки</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">Рентабельность</p>
              <p className={`text-xl font-bold ${summary.margin >= 30 ? 'text-green-600' : 'text-yellow-600'}`}>
                {summary.totalCost > 0 ? ((summary.totalProfit / summary.totalCost) * 100).toFixed(1) : 0}%
              </p>
              <p className="text-xs text-gray-400 mt-1">от себестоимости</p>
            </div>
            <div className="text-center p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-500 mb-2">Товаров в каталоге</p>
              <p className="text-xl font-bold text-blue-600">{formatNumber(summary.totalProducts)}</p>
              <p className="text-xs text-gray-400 mt-1">всего позиций</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};