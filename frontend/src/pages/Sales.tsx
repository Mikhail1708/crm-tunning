// frontend/src/pages/Sales.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { formatPrice, formatDate } from '../utils/formatters';
import { SaleDocument, OrderStatus } from '../types';
import { OrderStatusSelect } from '../components/ui/OrderStatusSelect';
import { 
  ShoppingCart, 
  TrendingUp, 
  Receipt, 
  Trash2,
  Search,
  Loader,
  Plus,
  Clock,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface SalesStats {
  total: number;
  totalRevenue: number;
  unpaidCount: number;
  unpaidAmount: number;
  averageCheck: number;
}

// Ключ для localStorage
const STORAGE_KEY = 'order_statuses';

export const Sales: React.FC = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState<SaleDocument[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [statusFilter, setStatusFilter] = useState<OrderStatus | 'all'>('all');

  // Загрузка статусов из localStorage
  const [orderStatuses, setOrderStatuses] = useState<Record<number, OrderStatus>>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        return JSON.parse(saved);
      } catch {
        return {};
      }
    }
    return {};
  });

  // Сохранение статусов в localStorage при изменении
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(orderStatuses));
  }, [orderStatuses]);

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async (): Promise<void> => {
    try {
      setLoading(true);
      const { data } = await saleDocumentsApi.getAll();
      //console.log('Loaded documents:', data);
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: number, e: React.MouseEvent): Promise<void> => {
    e.stopPropagation();
    if (confirm('Удалить заказ? Все товары вернутся на склад')) {
      try {
        await saleDocumentsApi.delete(id);
        toast.success('Заказ удален, товары возвращены');
        loadDocuments();
      } catch (error) {
        toast.error('Ошибка удаления');
      }
    }
  };

  const handleRowClick = (id: number): void => {
    console.log('Navigating to order:', id);
    navigate(`/sales/${id}`);
  };

  // Функция изменения статуса
  const handleStatusChange = (orderId: number, newStatus: OrderStatus): void => {
    setOrderStatuses(prev => ({
      ...prev,
      [orderId]: newStatus
    }));
    
    const statusLabels: Record<OrderStatus, string> = {
      ordered: 'Оформлен',
      assembling: 'Собирается',
      shipped: 'Отправлен'
    };
    toast.success(`Статус заказа изменен на "${statusLabels[newStatus]}"`);
  };

  // Получить статус заказа (из localStorage или 'ordered' по умолчанию)
  const getOrderStatus = (orderId: number): OrderStatus => {
    return orderStatuses[orderId] || 'ordered';
  };

  // Фильтрация документов
  const filterDocuments = (doc: SaleDocument): boolean => {
    // Поиск по тексту
    if (searchTerm.trim()) {
      const searchLower = searchTerm.toLowerCase().trim();
      let matches = false;
      
      if (doc.documentNumber?.toLowerCase().includes(searchLower)) matches = true;
      if (doc.customerName?.toLowerCase().includes(searchLower)) matches = true;
      if (doc.customerPhone?.toLowerCase().includes(searchLower)) matches = true;
      
      if (doc.items?.some(item => 
        item.productName?.toLowerCase().includes(searchLower) ||
        item.productArticle?.toLowerCase().includes(searchLower)
      )) matches = true;
      
      if (doc.total?.toString().includes(searchLower)) matches = true;
      
      if (!matches) return false;
    }
    
    // Фильтр по статусу заказа
    if (statusFilter !== 'all') {
      const docStatus = getOrderStatus(doc.id);
      if (docStatus !== statusFilter) return false;
    }
    
    return true;
  };

  const filteredDocuments = documents.filter(filterDocuments);

  // Подсчет статистики
  const paidDocuments = documents.filter(doc => doc.paymentStatus === 'paid');
  const unpaidDocuments = documents.filter(doc => doc.paymentStatus === 'unpaid');
  
  const stats: SalesStats = {
    total: documents.length,
    totalRevenue: paidDocuments.reduce((sum, d) => sum + (d.total || 0), 0),
    unpaidCount: unpaidDocuments.length,
    unpaidAmount: unpaidDocuments.reduce((sum, d) => sum + (d.total || 0), 0),
    averageCheck: paidDocuments.length > 0 
      ? paidDocuments.reduce((sum, d) => sum + (d.total || 0), 0) / paidDocuments.length 
      : 0,
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Заказы</h1>
          <p className="text-gray-500 dark:text-gray-400 mt-1">Управление заказами и документами</p>
        </div>
        <Button 
          onClick={() => navigate('/sales/new')} 
          icon={Plus}
          variant="success"
          size="lg"
          className="shadow-lg bg-green-600 hover:bg-green-700"
        >
          Новый заказ
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Всего заказов</p>
                <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.total}</p>
              </div>
              <ShoppingCart size={32} className="text-primary-600 opacity-50" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Общая выручка</p>
                <p className="text-2xl font-bold text-green-600">{formatPrice(stats.totalRevenue)}</p>
                <p className="text-xs text-gray-400 mt-1">по оплаченным заказам</p>
              </div>
              <TrendingUp size={32} className="text-green-600 opacity-50" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Неоплаченные заказы</p>
                <p className="text-2xl font-bold text-orange-600">{stats.unpaidCount}</p>
                {stats.unpaidAmount > 0 && (
                  <p className="text-xs text-gray-500 mt-1">
                    на сумму {formatPrice(stats.unpaidAmount)}
                  </p>
                )}
              </div>
              <Clock size={32} className="text-orange-500 opacity-50" />
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500 dark:text-gray-400">Средний чек</p>
                <p className="text-2xl font-bold text-purple-600">{formatPrice(stats.averageCheck)}</p>
                <p className="text-xs text-gray-400 mt-1">по оплаченным заказам</p>
              </div>
              <Receipt size={32} className="text-purple-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Предупреждение о неоплаченных заказах */}
      {stats.unpaidCount > 0 && (
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 flex items-center gap-3">
          <AlertCircle size={20} className="text-yellow-600 dark:text-yellow-500" />
          <p className="text-yellow-800 dark:text-yellow-300 text-sm">
            <span className="font-semibold">Внимание:</span> {stats.unpaidCount} заказ(ов) не оплачено на сумму {formatPrice(stats.unpaidAmount)}.
            Неоплаченные заказы не учитываются в выручке.
          </p>
        </div>
      )}

      {/* Search */}
      <Card>
        <CardBody className="p-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
            <Input
              type="text"
              placeholder="Поиск по номеру заказа, покупателю, телефону или товару..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
        </CardBody>
      </Card>

      {/* Фильтры по статусу заказа */}
      <div className="flex flex-wrap gap-2">
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
            statusFilter === 'all' 
              ? 'bg-gray-800 text-white dark:bg-gray-200 dark:text-gray-800' 
              : 'bg-gray-100 text-gray-600 hover:bg-gray-200 dark:bg-gray-700 dark:text-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Все заказы
        </button>
        <button
          onClick={() => setStatusFilter('ordered')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
            statusFilter === 'ordered' 
              ? 'bg-blue-600 text-white' 
              : 'bg-blue-50 text-blue-600 hover:bg-blue-100 dark:bg-blue-900/30 dark:text-blue-400'
          }`}
        >
          Оформлен
        </button>
        <button
          onClick={() => setStatusFilter('assembling')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
            statusFilter === 'assembling' 
              ? 'bg-yellow-600 text-white' 
              : 'bg-yellow-50 text-yellow-600 hover:bg-yellow-100 dark:bg-yellow-900/30 dark:text-yellow-400'
          }`}
        >
          Собирается
        </button>
        <button
          onClick={() => setStatusFilter('shipped')}
          className={`px-3 py-1.5 rounded-full text-sm font-medium transition-all flex items-center gap-1 ${
            statusFilter === 'shipped' 
              ? 'bg-green-600 text-white' 
              : 'bg-green-50 text-green-600 hover:bg-green-100 dark:bg-green-900/30 dark:text-green-400'
          }`}
        >
          Отправлен
        </button>
      </div>

      {/* Orders Table */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th>№ заказа</Th>
                  <Th>Дата</Th>
                  <Th>Покупатель</Th>
                  <Th>Телефон</Th>
                  <Th>Товаров</Th>
                  <Th>Сумма</Th>
                  <Th>Статус оплаты</Th>
                  <Th>Статус заказа</Th>
                  <Th>Действия</Th>
                </Tr>
              </Thead>
              <Tbody>
                {filteredDocuments.map((doc) => (
                  <Tr 
                    key={doc.id} 
                    className="hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors group cursor-pointer"
                    onClick={() => handleRowClick(doc.id)}
                  >
                    <Td className="font-mono text-sm font-medium text-primary-600 dark:text-primary-400">{doc.documentNumber}</Td>
                    <Td className="dark:text-gray-300">{formatDate(doc.saleDate)}</Td>
                    <Td className="dark:text-gray-300">{doc.customerName || doc.clientName || '—'}</Td>
                    <Td className="dark:text-gray-300">{doc.customerPhone || doc.clientPhone || '—'}</Td>
                    <Td className="dark:text-gray-300">{doc.items?.length || 0} шт.</Td>
                    <Td className="font-semibold dark:text-gray-300">{formatPrice(doc.total)}</Td>
                    <Td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                        doc.paymentStatus === 'paid' 
                          ? 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' 
                          : 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400'
                      }`}>
                        {doc.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен'}
                      </span>
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <OrderStatusSelect
                        orderId={doc.id}
                        currentStatus={getOrderStatus(doc.id)}
                        onStatusChange={handleStatusChange}
                        size="sm"
                      />
                    </Td>
                    <Td onClick={(e) => e.stopPropagation()}>
                      <button
                        onClick={(e) => handleDelete(doc.id, e)}
                        className="p-2 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="Удалить заказ"
                      >
                        <Trash2 size={18} />
                      </button>
                    </Td>
                  </Tr>
                ))}
              </Tbody>
            </Table>
          </div>
          {filteredDocuments.length === 0 && (
            <div className="text-center py-12 text-gray-500 dark:text-gray-400">
              <ShoppingCart size={48} className="mx-auto mb-3 opacity-50" />
              <p>Заказы не найдены</p>
              {searchTerm && (
                <p className="text-sm mt-2 text-gray-400">
                  Попробуйте изменить поисковый запрос
                </p>
              )}
              <button
                onClick={() => navigate('/sales/new')}
                className="mt-3 text-primary-600 hover:underline"
              >
                Создать первый заказ
              </button>
            </div>
          )}
        </CardBody>
      </Card>
    </div>
  );
};

export default Sales;