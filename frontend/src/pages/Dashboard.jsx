// frontend/src/pages/Dashboard.jsx
import React, { useState, useEffect, useCallback } from 'react';
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
  ArrowRight,
  CheckCircle,
  XCircle,
  MapPin,
  RefreshCw,
  Calendar
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Dashboard = () => {
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdate, setLastUpdate] = useState(null);
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
    averageCheck: 0,
    unpaidSales: 0,
    unpaidTotal: 0
  });
  const [lowStockProducts, setLowStockProducts] = useState([]);
  const [topProducts, setTopProducts] = useState([]);
  const [recentSales, setRecentSales] = useState([]);
  const [recentClients, setRecentClients] = useState([]);

  const loadDashboardData = useCallback(async (force = false) => {
    try {
      setLoading(true);
      
      console.log('🔄 Loading dashboard data...', force ? '(force refresh)' : '');
      
      // Получаем все данные параллельно
      const [productsRes, lowStockRes, clientsRes, salesRes] = await Promise.all([
        productsApi.getAll(),
        productsApi.getLowStock(),
        clientsApi.getAll({ limit: 1000, sortBy: 'createdAt', sortOrder: 'desc' }),
        saleDocumentsApi.getAll()
      ]);
      
      const allProducts = productsRes.data || [];
      const allSales = salesRes.data || [];
      const lowStockData = lowStockRes.data || [];
      const clients = clientsRes.data?.clients || [];
      const totalClients = clientsRes.data?.total || 0;
      
      console.log('📊 Data loaded:', {
        products: allProducts.length,
        sales: allSales.length,
        lowStock: lowStockData.length,
        clients: totalClients
      });
      
      // 🔥 Фильтруем ТОЛЬКО ОПЛАЧЕННЫЕ заказы
      const paidSales = allSales.filter(sale => {
        const status = (sale.paymentStatus || '').toLowerCase();
        return status === 'paid' || status === 'оплачен' || status === 'payed' || status === true;
      });
      
      const unpaidSales = allSales.filter(sale => {
        const status = (sale.paymentStatus || '').toLowerCase();
        return status !== 'paid' && status !== 'оплачен' && status !== 'payed' && status !== true;
      });
      
      console.log('💰 Paid sales:', paidSales.length);
      console.log('💸 Unpaid sales:', unpaidSales.length);
      
      // Рассчитываем статистику ТОЛЬКО по оплаченным заказам
      let totalRevenue = 0;
      let totalCost = 0;
      let totalProfit = 0;
      
      paidSales.forEach(sale => {
        const saleTotal = sale.total || 0;
        totalRevenue += saleTotal;
        
        // Рассчитываем себестоимость из товаров в заказе
        let saleCost = 0;
        if (sale.items && sale.items.length > 0) {
          sale.items.forEach(item => {
            const costPrice = item.cost_price || 0;
            const quantity = item.quantity || 0;
            saleCost += costPrice * quantity;
          });
        } else if (sale.saleItems && sale.saleItems.length > 0) {
          // Альтернативное название поля
          sale.saleItems.forEach(item => {
            const costPrice = item.cost_price || 0;
            const quantity = item.quantity || 0;
            saleCost += costPrice * quantity;
          });
        }
        totalCost += saleCost;
      });
      
      totalProfit = totalRevenue - totalCost;
      const margin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;
      const totalSalesCount = paidSales.length;
      const averageCheck = totalSalesCount > 0 ? totalRevenue / totalSalesCount : 0;
      
      // Неоплаченные заказы
      const unpaidTotal = unpaidSales.reduce((sum, sale) => sum + (sale.total || 0), 0);
      
      // Подсчет общего количества товаров на складе
      const totalStock = allProducts.reduce((sum, p) => sum + (p.stock || 0), 0);
      
      // Подсчет товаров с низким остатком
      const lowStockProductsList = lowStockData.length > 0 ? lowStockData : allProducts.filter(p => p.stock <= (p.min_stock || 5));
      
      const newSummary = {
        totalRevenue,
        totalProfit,
        totalCost,
        margin,
        totalSales: totalSalesCount,
        totalProducts: allProducts.length,
        lowStockCount: lowStockProductsList.length,
        totalClients,
        totalStock,
        averageCheck,
        unpaidSales: unpaidSales.length,
        unpaidTotal
      };
      
      console.log('📈 Summary calculated:', newSummary);
      setSummary(newSummary);
      setLowStockProducts(lowStockProductsList);
      setLastUpdate(new Date());
      
      // Формируем популярные товары из оплаченных заказов
      const productSalesMap = new Map();
      
      paidSales.forEach(sale => {
        const items = sale.items || sale.saleItems || [];
        if (items.length > 0) {
          items.forEach(item => {
            const productId = item.productId;
            const productName = item.productName || item.name;
            const quantity = item.quantity || 0;
            const total = item.total || (item.price * quantity);
            
            if (!productSalesMap.has(productId)) {
              productSalesMap.set(productId, {
                id: productId,
                name: productName,
                article: item.productArticle,
                total_sold: 0,
                total_revenue: 0,
                retail_price: item.price || 0
              });
            }
            const product = productSalesMap.get(productId);
            product.total_sold += quantity;
            product.total_revenue += total;
          });
        }
      });
      
      // Добавляем данные из каталога
      const formattedTopProducts = Array.from(productSalesMap.values())
        .filter(p => p.total_sold > 0)
        .sort((a, b) => b.total_sold - a.total_sold)
        .slice(0, 5)
        .map(product => {
          const catalogProduct = allProducts.find(p => p.id === product.id);
          return {
            id: product.id,
            name: product.name || 'Без названия',
            article: catalogProduct?.article || product.article || '—',
            retail_price: product.retail_price || catalogProduct?.retail_price || 0,
            total_sold: product.total_sold,
            total_revenue: product.total_revenue,
            profit_margin: catalogProduct?.retail_price && catalogProduct?.cost_price 
              ? ((catalogProduct.retail_price - catalogProduct.cost_price) / catalogProduct.retail_price * 100).toFixed(1)
              : 0
          };
        });
      setTopProducts(formattedTopProducts);
      
      // Последние 5 заказов (все заказы)
      const recentSalesData = allSales
        .sort((a, b) => new Date(b.saleDate) - new Date(a.saleDate))
        .slice(0, 5)
        .map(sale => {
          // Рассчитываем прибыль для заказа
          let orderCost = 0;
          const items = sale.items || sale.saleItems || [];
          items.forEach(item => {
            orderCost += (item.cost_price || 0) * (item.quantity || 0);
          });
          const orderProfit = (sale.total || 0) - orderCost;
          
          // Определяем тип документа
          let docType = 'Заказ';
          if (sale.documentType === 'receipt') docType = 'Чек';
          else if (sale.documentType === 'invoice') docType = 'Счет';
          
          const isPaid = (sale.paymentStatus || '').toLowerCase() === 'paid' || 
                         (sale.paymentStatus || '').toLowerCase() === 'оплачен' ||
                         sale.paymentStatus === true;
          
          return {
            id: sale.id,
            documentNumber: sale.documentNumber,
            saleDate: sale.saleDate,
            customerName: sale.customerName || sale.clientName || '-',
            customerCity: sale.client?.city || sale.customerCity || '-',
            total: sale.total || 0,
            profit: orderProfit,
            documentType: docType,
            paymentStatus: isPaid ? 'Оплачен' : 'Не оплачен',
            isPaid: isPaid
          };
        });
      setRecentSales(recentSalesData);
      
      // Последние 5 клиентов
      const recentClientsData = clients.slice(0, 5).map(client => ({
        id: client.id,
        name: [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ') || client.firstName || client.name || 'Без имени',
        phone: client.phone,
        city: client.city,
        createdAt: client.createdAt,
        totalSpent: client.totalSpent || 0
      }));
      setRecentClients(recentClientsData);
      
    } catch (error) {
      console.error('❌ Error loading dashboard:', error);
      toast.error('Ошибка загрузки данных: ' + (error.response?.data?.error || error.message));
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboardData();
    
    // Автоматическое обновление каждые 30 секунд
    const interval = setInterval(() => {
      loadDashboardData(true);
    }, 30000);
    
    return () => clearInterval(interval);
  }, [loadDashboardData]);

  const handleRefresh = () => {
    setRefreshing(true);
    loadDashboardData(true);
    toast.success('Данные обновлены');
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
      description: 'оплаченных заказов'
    },
    {
      title: 'Выручка',
      value: formatPrice(summary.totalRevenue),
      icon: DollarSign,
      bg: 'bg-green-100',
      color: 'text-green-600',
      description: 'от оплаченных заказов'
    },
    {
      title: 'Прибыль',
      value: formatPrice(summary.totalProfit),
      icon: TrendingUp,
      bg: 'bg-purple-100',
      color: 'text-purple-600',
      description: 'чистая прибыль'
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
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Дашборд</h1>
          <p className="text-gray-500 mt-1">Обзор состояния бизнеса</p>
          {lastUpdate && (
            <p className="text-xs text-gray-400 mt-1 flex items-center gap-1">
              <Calendar size={12} />
              Последнее обновление: {formatDate(lastUpdate)} {lastUpdate.toLocaleTimeString()}
            </p>
          )}
        </div>
        <button
          onClick={handleRefresh}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <RefreshCw size={18} className={refreshing ? 'animate-spin' : ''} />
          <span className="text-sm">Обновить</span>
        </button>
      </div>

      {/* Предупреждение о неоплаченных заказах */}
      {summary.unpaidSales > 0 && (
        <div className="bg-yellow-50 border-l-4 border-yellow-400 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="text-yellow-400 flex-shrink-0 mt-0.5" size={20} />
            <div>
              <p className="text-yellow-800 font-medium">
                Внимание: {summary.unpaidSales} неоплаченных заказов на сумму {formatPrice(summary.unpaidTotal)}
              </p>
              <p className="text-yellow-700 text-sm mt-1">
                В статистике дашборда учитываются только оплаченные заказы. 
                Неоплаченные заказы не влияют на выручку, прибыль и средний чек.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-4">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 hover:shadow-md transition-all group relative">
            <div className="flex items-center justify-between mb-2">
              <div className={`w-10 h-10 rounded-xl ${stat.bg} flex items-center justify-center`}>
                <stat.icon size={20} className={stat.color} />
              </div>
              <span className="text-xs text-gray-400">{stat.description}</span>
            </div>
            <p className="text-2xl font-bold text-gray-900">{stat.value}</p>
            <p className="text-xs text-gray-500 mt-1">{stat.title}</p>
          </div>
        ))}
      </div>

      {/* Two column layout */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Low Stock Products */}
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
                      <p className="text-xs text-gray-500">Артикул: {product.article || '-'}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-500">Остаток</p>
                      <p className="font-bold text-yellow-600">{product.stock} шт.</p>
                      <p className="text-xs text-gray-500">Мин: {product.min_stock || 5} шт.</p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Top Products */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200">
          <div className="p-5 border-b border-gray-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <TrendingUp size={20} className="text-primary-600" />
                <h2 className="text-lg font-semibold text-gray-900">Популярные товары</h2>
              </div>
              <span className="text-xs text-gray-400">Топ по продажам (оплаченные)</span>
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

      {/* Second row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Orders */}
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
                  <div 
                    key={sale.id} 
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer" 
                    onClick={() => window.location.href = `/sales/${sale.id}`}
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-medium text-gray-900 text-sm">{sale.documentNumber}</p>
                        <span className={`px-2 py-0.5 text-xs rounded-full flex items-center gap-1 ${
                          sale.isPaid ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {sale.isPaid ? <CheckCircle size={10} /> : <XCircle size={10} />}
                          {sale.paymentStatus}
                        </span>
                        <span className={`px-2 py-0.5 text-xs rounded-full ${
                          sale.documentType === 'Чек' ? 'bg-green-100 text-green-700' : 
                          sale.documentType === 'Счет' ? 'bg-blue-100 text-blue-700' : 
                          'bg-purple-100 text-purple-700'
                        }`}>
                          {sale.documentType}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 mt-1 flex-wrap">
                        <p className="text-xs text-gray-500">
                          {sale.customerName}
                        </p>
                        {sale.customerCity && sale.customerCity !== '-' && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPin size={10} />
                            {sale.customerCity}
                          </span>
                        )}
                        <span className="text-xs text-gray-400">•</span>
                        <p className="text-xs text-gray-500">{formatDate(sale.saleDate)}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p className={`font-semibold ${sale.isPaid ? 'text-green-600' : 'text-gray-400'}`}>
                        {formatPrice(sale.total)}
                      </p>
                      {!sale.isPaid && (
                        <p className="text-xs text-gray-400">ожидает оплаты</p>
                      )}
                      {sale.isPaid && sale.profit > 0 && (
                        <p className="text-xs text-green-600">+{formatPrice(sale.profit)}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* New Clients */}
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
                  <div 
                    key={client.id} 
                    className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors cursor-pointer"
                    onClick={() => window.location.href = `/clients/${client.id}`}
                  >
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{client.name}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <p className="text-xs text-gray-500">{client.phone}</p>
                        {client.city && (
                          <span className="flex items-center gap-1 text-xs text-gray-400">
                            <MapPin size={10} />
                            {client.city}
                          </span>
                        )}
                      </div>
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

      {/* Key Metrics */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-5 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Ключевые показатели</h2>
          <p className="text-xs text-gray-400 mt-1">* Данные только по оплаченным заказам</p>
        </div>
        <div className="p-5">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
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