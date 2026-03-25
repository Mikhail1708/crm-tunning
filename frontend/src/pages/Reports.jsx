// frontend/src/pages/Reports.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { reportsApi } from '../api/reports';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { formatPrice, formatDate } from '../utils/formatters';
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
  ResponsiveContainer
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
  Trash2,
  FileSpreadsheet,
  BarChart3,
  LineChart as LineChartIcon
} from 'lucide-react';
import toast from 'react-hot-toast';

const ConfirmModal = ({ isOpen, onClose, onConfirm, title, message }) => {
  if (!isOpen) return null;
  
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white rounded-xl shadow-xl max-w-md w-full">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
        </div>
        <div className="p-6">
          <p className="text-gray-600">{message}</p>
        </div>
        <div className="flex gap-3 p-6 pt-0">
          <Button variant="danger" onClick={onConfirm} fullWidth>
            Да, очистить
          </Button>
          <Button variant="secondary" onClick={onClose} fullWidth>
            Отмена
          </Button>
        </div>
      </div>
    </div>
  );
};

export const Reports = () => {
  const [loading, setLoading] = useState(true);
  const [orders, setOrders] = useState([]);
  const [stats, setStats] = useState({
    totalOrders: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalCost: 0,
    averageCheck: 0,
    margin: 0
  });
  
  const [period, setPeriod] = useState('month');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [showCustom, setShowCustom] = useState(false);
  const [viewMode, setViewMode] = useState('table');
  const [chartType, setChartType] = useState('line');
  const [showClearModal, setShowClearModal] = useState(false);
  const [clearing, setClearing] = useState(false);

  useEffect(() => {
    loadOrders();
  }, [period, startDate, endDate]);

  const loadOrders = async () => {
    setLoading(true);
    try {
      console.log('=== ЗАГРУЗКА ОТЧЕТОВ ===');
      
      // Получаем все документы
      const response = await saleDocumentsApi.getAll();
      console.log('Все документы:', response.data);
      
      let allDocuments = response.data || [];
      
      // Показываем все документы продажи (и заказы, и чеки)
      // Не фильтруем по типу, так как чеки и заказы - это продажи
      const allSales = allDocuments;
      console.log('Все продажи (документы):', allSales);
      
      // Фильтрация по дате
      let filteredSales = [...allSales];
      const now = new Date();
      
      if (period === 'custom' && startDate && endDate) {
        const start = new Date(startDate);
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        filteredSales = allSales.filter(sale => {
          const saleDate = new Date(sale.saleDate);
          return saleDate >= start && saleDate <= end;
        });
      } else if (period === 'day') {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        filteredSales = allSales.filter(sale => {
          const saleDate = new Date(sale.saleDate);
          saleDate.setHours(0, 0, 0, 0);
          return saleDate.getTime() === today.getTime();
        });
      } else if (period === 'week') {
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);
        filteredSales = allSales.filter(sale => new Date(sale.saleDate) >= weekAgo);
      } else if (period === 'month') {
        const monthAgo = new Date();
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        filteredSales = allSales.filter(sale => new Date(sale.saleDate) >= monthAgo);
      } else if (period === 'year') {
        const yearAgo = new Date();
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        filteredSales = allSales.filter(sale => new Date(sale.saleDate) >= yearAgo);
      }
      
      console.log('Отфильтрованные продажи:', filteredSales);
      
      // Форматируем продажи для отображения
      const formattedSales = filteredSales.map(sale => {
        // Вычисляем себестоимость из items
        const itemsWithCost = (sale.items || []).map(item => {
          // Если cost_price нет в item, пробуем взять из product
          const costPrice = item.cost_price || item.product?.cost_price || 0;
          return {
            name: item.productName || item.product?.name || 'Товар',
            article: item.productArticle || item.product?.article || '-',
            quantity: item.quantity,
            price: item.price,
            total: item.total,
            cost_price: costPrice,
            cost_total: costPrice * item.quantity
          };
        });
        
        const totalCost = itemsWithCost.reduce((sum, item) => sum + item.cost_total, 0);
        const totalProfit = sale.total - totalCost;
        
        // Определяем тип документа для отображения
        const docType = sale.documentType === 'receipt' ? 'Чек' : sale.documentType === 'invoice' ? 'Счет' : 'Заказ';
        
        return {
          id: sale.id,
          documentNumber: sale.documentNumber,
          documentType: docType,
          saleDate: sale.saleDate,
          customerName: sale.customerName || sale.clientName || '-',
          customerPhone: sale.customerPhone || sale.clientPhone || '-',
          items: itemsWithCost,
          subtotal: sale.subtotal || 0,
          discount: sale.discount || 0,
          total: sale.total || 0,
          paymentStatus: sale.paymentStatus,
          totalProfit: totalProfit,
          totalCost: totalCost
        };
      });
      
      console.log('Форматированные продажи:', formattedSales);
      setOrders(formattedSales);
      
      // Вычисляем статистику
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
        margin
      });
      
      console.log('Статистика:', { totalOrders, totalRevenue, totalCost, totalProfit, averageCheck, margin });
      
    } catch (error) {
      console.error('Error loading orders:', error);
      toast.error('Ошибка загрузки отчетов: ' + (error.message || 'Неизвестная ошибка'));
    } finally {
      setLoading(false);
    }
  };

  const chartData = useMemo(() => {
    const grouped = {};
    orders.forEach(order => {
      const date = new Date(order.saleDate).toLocaleDateString('ru-RU');
      if (!grouped[date]) {
        grouped[date] = { date, revenue: 0, profit: 0, cost: 0, orders: 0 };
      }
      grouped[date].revenue += order.total || 0;
      grouped[date].profit += order.totalProfit || 0;
      grouped[date].cost += order.totalCost || 0;
      grouped[date].orders += 1;
    });
    return Object.values(grouped).sort((a, b) => new Date(a.date) - new Date(b.date));
  }, [orders]);

  const exportToExcel = () => {
    if (!orders.length) {
      toast.error('Нет данных для экспорта');
      return;
    }
    
    const exportData = orders.map(order => ({
      'Тип': order.documentType,
      'Номер документа': order.documentNumber,
      'Дата': formatDate(order.saleDate),
      'Покупатель': order.customerName || '-',
      'Телефон': order.customerPhone || '-',
      'Сумма': order.subtotal || 0,
      'Скидка': order.discount || 0,
      'Итого': order.total || 0,
      'Себестоимость': order.totalCost || 0,
      'Прибыль': order.totalProfit || 0,
      'Рентабельность': order.totalCost > 0 ? ((order.totalProfit / order.totalCost) * 100).toFixed(1) + '%' : '0%',
      'Статус': order.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен',
      'Состав': order.items?.map(item => `${item.name} (${item.quantity}шт x ${item.price}₽)`).join('; ') || '-'
    }));
    
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Отчет по продажам');
    
    const colWidths = [
      { wch: 10 }, { wch: 20 }, { wch: 20 }, { wch: 25 }, 
      { wch: 15 }, { wch: 12 }, { wch: 10 }, { wch: 12 }, 
      { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 50 }
    ];
    ws['!cols'] = colWidths;
    
    XLSX.writeFile(wb, `sales_report_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast.success('Отчет экспортирован в Excel');
  };

  const handleClearHistory = async () => {
    setClearing(true);
    try {
      await reportsApi.deleteAllSales();
      toast.success('История продаж очищена');
      loadOrders();
      setShowClearModal(false);
    } catch (error) {
      console.error('Error clearing history:', error);
      toast.error(error.response?.data?.message || 'Ошибка очистки истории');
    } finally {
      setClearing(false);
    }
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
          <Button 
            onClick={() => setShowClearModal(true)} 
            icon={Trash2} 
            variant="danger"
          >
            Очистить историю
          </Button>
        </div>
      </div>

      {/* Фильтры */}
      <Card>
        <CardBody className="p-4">
          <div className="flex flex-wrap gap-3 items-center">
            <Calendar size={18} className="text-gray-400" />
            <div className="flex gap-2">
              {['day', 'week', 'month', 'year'].map(p => (
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

      {/* Переключатель вида */}
      <div className="flex justify-end gap-2">
        <Button
          variant={viewMode === 'table' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setViewMode('table')}
          icon={BarChart3}
        >
          Таблица
        </Button>
        <Button
          variant={viewMode === 'chart' ? 'primary' : 'secondary'}
          size="sm"
          onClick={() => setViewMode('chart')}
          icon={LineChartIcon}
        >
          График
        </Button>
      </div>

      {/* Графики */}
      {viewMode === 'chart' && chartData.length > 0 && (
        <Card>
          <CardBody className="p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Динамика продаж</h2>
              <div className="flex gap-2">
                <Button
                  variant={chartType === 'line' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setChartType('line')}
                >
                  Линейный
                </Button>
                <Button
                  variant={chartType === 'bar' ? 'primary' : 'secondary'}
                  size="sm"
                  onClick={() => setChartType('bar')}
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
                  <Tooltip formatter={(value) => formatPrice(value)} />
                  <Legend />
                  <Line yAxisId="left" type="monotone" dataKey="revenue" stroke="#10b981" name="Выручка" strokeWidth={2} />
                  <Line yAxisId="right" type="monotone" dataKey="profit" stroke="#8b5cf6" name="Прибыль" strokeWidth={2} />
                </LineChart>
              ) : (
                <BarChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" />
                  <YAxis />
                  <Tooltip formatter={(value) => formatPrice(value)} />
                  <Legend />
                  <Bar dataKey="revenue" fill="#10b981" name="Выручка" />
                  <Bar dataKey="profit" fill="#8b5cf6" name="Прибыль" />
                </BarChart>
              )}
            </ResponsiveContainer>
          </CardBody>
        </Card>
      )}

      {/* Таблица продаж */}
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
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Состав</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Сумма</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Скидка</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Итого</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Себестоимость</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Прибыль</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Статус</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan="12" className="text-center py-12">
                      <ShoppingBag size={48} className="mx-auto mb-3 text-gray-300" />
                      <p className="text-gray-500">Нет продаж за выбранный период</p>
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
                      <td className="px-4 py-3 text-sm text-gray-900">{order.customerName || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500">{order.customerPhone || '-'}</td>
                      <td className="px-4 py-3 text-sm text-gray-500 max-w-md">
                        <div className="truncate" title={order.items?.map(i => `${i.name} x${i.quantity}`).join(', ')}>
                          {order.items?.map(i => `${i.name} x${i.quantity}`).join(', ') || '-'}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-sm text-right">{formatPrice(order.subtotal || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right text-red-600">-{formatPrice(order.discount || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right font-semibold">{formatPrice(order.total || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right text-orange-600">{formatPrice(order.totalCost || 0)}</td>
                      <td className="px-4 py-3 text-sm text-right text-green-600 font-semibold">{formatPrice(order.totalProfit || 0)}</td>
                      <td className="px-4 py-3">
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                          order.paymentStatus === 'paid' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {order.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен'}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </CardBody>
      </Card>

      <ConfirmModal
        isOpen={showClearModal}
        onClose={() => setShowClearModal(false)}
        onConfirm={handleClearHistory}
        title="Очистка истории продаж"
        message="Вы уверены, что хотите удалить всю историю продаж? Это действие нельзя отменить. Все товары будут возвращены на склад."
      />
    </div>
  );
};