// frontend/src/pages/OrderDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from '../components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { formatPrice, formatDate } from '../utils/formatters';
import { PrintDocument, ReceiptType, LegalEntityData } from '../components/ui/PrintDocument';
import { ReceiptTypeModal } from '../components/ui/ReceiptTypeModal';
import { LegalEntityModal } from '../components/ui/LegalEntityModal';
import { SaleDocument, OrderStatus } from '../types';
import { OrderStatusBadge } from '../components/ui/OrderStatusBadge';
import { OrderStatusSelect } from '../components/ui/OrderStatusSelect';
import { 
  ArrowLeft, 
  Printer, 
  FileText, 
  Receipt, 
  CreditCard,
  Mail,
  Phone,
  MapPin,
  User,
  Package,
  DollarSign,
  CheckCircle,
  XCircle,
  Truck,
  MessageSquare,
  Percent
} from 'lucide-react';
import toast from 'react-hot-toast';

export const OrderDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [order, setOrder] = useState<SaleDocument | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [generating, setGenerating] = useState<boolean>(false);
  const [updatingStatus, setUpdatingStatus] = useState<boolean>(false);
  
  // Состояния для модальных окон чека
  const [showReceiptTypeModal, setShowReceiptTypeModal] = useState<boolean>(false);
  const [showLegalEntityModal, setShowLegalEntityModal] = useState<boolean>(false);
  const [legalData, setLegalData] = useState<LegalEntityData | null>(null);

  // Статус заказа из БД (сервера)
  const [orderStatus, setOrderStatus] = useState<OrderStatus>('ordered');

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async (): Promise<void> => {
    try {
      setLoading(true);
      const response = await saleDocumentsApi.getById(Number(id));
      setOrder(response.data);
      // Устанавливаем статус из данных с сервера
      setOrderStatus(response.data.orderStatus || 'ordered');
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Ошибка загрузки заказа');
      navigate('/sales');
    } finally {
      setLoading(false);
    }
  };

  // Функция изменения статуса - синхронизация с сервером
  const handleStatusChange = async (orderId: number, newStatus: OrderStatus): Promise<void> => {
    if (updatingStatus) return;
    
    setUpdatingStatus(true);
    const statusLabels: Record<OrderStatus, string> = {
      ordered: 'Оформлен',
      assembling: 'Собирается',
      shipped: 'Отправлен'
    };
    
    // Оптимистичное обновление UI
    setOrderStatus(newStatus);
    toast.loading(`Обновление статуса...`, { id: 'status-update' });
    
    try {
      // Отправляем запрос на сервер
      await saleDocumentsApi.updateOrderStatus(orderId, newStatus);
      
      // Обновляем статус в локальном объекте заказа
      if (order) {
        setOrder({ ...order, orderStatus: newStatus });
      }
      
      toast.success(`Статус заказа: ${statusLabels[newStatus]}`, { id: 'status-update' });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast.error('Ошибка обновления статуса', { id: 'status-update' });
      // Откатываем статус при ошибке
      if (order) {
        setOrderStatus(order.orderStatus || 'ordered');
      }
    } finally {
      setUpdatingStatus(false);
    }
  };

  // Остальные функции (handleMarkAsPaid, handleOpenReceiptModal, etc.) остаются без изменений
  const handleMarkAsPaid = async (): Promise<void> => {
    if (!order) return;
    
    setGenerating(true);
    try {
      await saleDocumentsApi.updatePaymentStatus(order.id, 'paid');
      const updatedOrder = { ...order, paymentStatus: 'paid' };
      setOrder(updatedOrder);
      toast.success('Заказ отмечен как оплаченный');
    } catch (error) {
      console.error('Error marking as paid:', error);
      toast.error('Ошибка при отметке оплаты');
    } finally {
      setGenerating(false);
    }
  };

  const handleOpenReceiptModal = () => {
    setShowReceiptTypeModal(true);
  };

  const handleReceiptTypeSelect = (type: ReceiptType) => {
    setShowReceiptTypeModal(false);
    
    if (type === 'legal') {
      setShowLegalEntityModal(true);
    } else {
      generateAndPrintReceipt('individual', null);
    }
  };

  const handleLegalEntitySubmit = async (data: LegalEntityData) => {
    setShowLegalEntityModal(false);
    setLegalData(data);
    generateAndPrintReceipt('legal', data);
  };

  const generateAndPrintReceipt = async (type: ReceiptType, legalDataParam: LegalEntityData | null) => {
    if (!order) return;
    
    setGenerating(true);
    try {
      if (order.paymentStatus !== 'paid') {
        await saleDocumentsApi.updatePaymentStatus(order.id, 'paid');
        const updatedOrder = { ...order, paymentStatus: 'paid' };
        setOrder(updatedOrder);
      }
      
      await saleDocumentsApi.update(order.id, { documentType: 'receipt' });
      const finalOrder = { ...order, documentType: 'receipt', paymentStatus: 'paid' };
      setOrder(finalOrder);
      
      toast.success(type === 'individual' ? 'Чек сформирован' : 'Счет-фактура сформирован');
      
      const { print } = PrintDocument({ 
        order: finalOrder, 
        type: 'receipt',
        receiptType: type,
        legalData: legalDataParam 
      });
      print();
      
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Ошибка формирования чека');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrintInvoice = async (): Promise<void> => {
    if (!order) return;
    
    setGenerating(true);
    try {
      await saleDocumentsApi.update(order.id, { documentType: 'invoice' });
      
      const updatedOrder = { ...order, documentType: 'invoice' };
      setOrder(updatedOrder);
      
      toast.success('Счет сформирован');
      
      const { print } = PrintDocument({ order: updatedOrder, type: 'invoice' });
      print();
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Ошибка формирования счета');
    } finally {
      setGenerating(false);
    }
  };

  const handlePrint = (): void => {
    if (!order) return;
    
    const type = order.documentType === 'receipt' ? 'receipt' : 'invoice';
    const receiptType = order.documentType === 'receipt' && legalData ? 'legal' : 'individual';
    const { print } = PrintDocument({ order, type, receiptType, legalData });
    print();
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="text-center">
          <p className="text-gray-500 mb-4">Заказ не найден</p>
          <Button onClick={() => navigate('/sales')} variant="primary">
            Вернуться к списку
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sales')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
              Заказ №{order.documentNumber}
            </h1>
            <p className="text-gray-500 dark:text-gray-400 mt-1">
              Создан {formatDate(order.saleDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handleOpenReceiptModal}
            disabled={generating}
            icon={Receipt}
            variant="success"
          >
            Чек
          </Button>
          <Button
            onClick={handlePrintInvoice}
            disabled={generating}
            icon={FileText}
            variant="primary"
          >
            Счет
          </Button>
        </div>
      </div>

      {/* Статус заказа и оплаты */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Блок статуса заказа */}
        <div className={`p-4 rounded-lg border ${
          orderStatus === 'ordered' 
            ? 'bg-blue-50 border-blue-200 dark:bg-blue-900/20 dark:border-blue-800' 
            : orderStatus === 'assembling'
            ? 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
            : 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <Truck size={20} className={
                orderStatus === 'ordered' 
                  ? 'text-blue-600' 
                  : orderStatus === 'assembling'
                  ? 'text-yellow-600'
                  : 'text-green-600'
              } />
              <span className="font-medium">Статус выполнения заказа</span>
            </div>
            <OrderStatusSelect
              orderId={order.id}
              currentStatus={orderStatus}
              onStatusChange={handleStatusChange}
              size="md"
              disabled={updatingStatus}
            />
          </div>
          <div className="mt-3">
            <OrderStatusBadge status={orderStatus} size="lg" showIcon={true} />
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">
              {orderStatus === 'ordered' && 'Заказ принят, ожидает обработки'}
              {orderStatus === 'assembling' && 'Идет сборка и подготовка заказа'}
              {orderStatus === 'shipped' && 'Заказ передан клиенту'}
            </p>
          </div>
        </div>

        {/* Блок статуса оплаты */}
        <div className={`p-4 rounded-lg border ${
          order.paymentStatus === 'paid' 
            ? 'bg-green-50 border-green-200 dark:bg-green-900/20 dark:border-green-800' 
            : 'bg-yellow-50 border-yellow-200 dark:bg-yellow-900/20 dark:border-yellow-800'
        }`}>
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              {order.paymentStatus === 'paid' ? (
                <CheckCircle className="text-green-600" size={20} />
              ) : (
                <XCircle className="text-yellow-600" size={20} />
              )}
              <span className={`font-medium ${
                order.paymentStatus === 'paid' ? 'text-green-700 dark:text-green-400' : 'text-yellow-700 dark:text-yellow-400'
              }`}>
                {order.paymentStatus === 'paid' ? 'Заказ оплачен' : 'Заказ ожидает оплаты'}
              </span>
              {order.documentType === 'receipt' && (
                <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400 text-xs rounded-full">
                  Чек выдан
                </span>
              )}
              {order.documentType === 'invoice' && (
                <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400 text-xs rounded-full">
                  Счет выставлен
                </span>
              )}
            </div>
            
            {order.paymentStatus !== 'paid' && (
              <Button
                onClick={handleMarkAsPaid}
                disabled={generating}
                icon={CreditCard}
                variant="secondary"
                size="sm"
              >
                {generating ? 'Обработка...' : 'Отметить как оплаченный'}
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Остальная часть страницы без изменений */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Информация о покупателе */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <User size={20} />
            Информация о покупателе
          </h2>
          <div className="space-y-3">
            {(order.customerName || order.clientName) && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <User size={16} />
                <span>{order.customerName || order.clientName}</span>
              </div>
            )}
            {(order.customerPhone || order.clientPhone) && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Phone size={16} />
                <span>{order.customerPhone || order.clientPhone}</span>
              </div>
            )}
            {order.customerEmail && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <Mail size={16} />
                <span>{order.customerEmail}</span>
              </div>
            )}
            {order.customerAddress && (
              <div className="flex items-center gap-2 text-gray-600 dark:text-gray-400">
                <MapPin size={16} />
                <span>{order.customerAddress}</span>
              </div>
            )}

            {order.description && (
              <div className="flex items-start gap-2 text-gray-600 dark:text-gray-400 mt-2 pt-2 border-t border-gray-100 dark:border-gray-700">
                <MessageSquare size={16} className="flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <span className="text-xs text-gray-400 block mb-0.5">Комментарий к заказу:</span>
                  <span className="text-sm">{order.description}</span>
                </div>
              </div>
            )}

            {!order.customerName && !order.clientName && !order.customerPhone && (
              <p className="text-gray-500 text-sm">Данные не указаны</p>
            )}
          </div>
        </div>

        {/* Итоги */}
        <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 p-6">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center gap-2">
            <DollarSign size={20} />
            Итоги заказа
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600 dark:text-gray-400">Сумма:</span>
              <span className="dark:text-gray-300">{formatPrice(order.subtotal)}</span>
            </div>
            
            {(order as any).clientDiscount && (order as any).clientDiscount > 0 && (
              <div className="flex justify-between text-sm text-green-600">
                <span className="flex items-center gap-1">
                  <Percent size={14} />
                  Скидка клиента ({(order as any).clientDiscount}%):
                </span>
                <span>-{formatPrice((order as any).clientDiscountAmount || 0)}</span>
              </div>
            )}
            
            {order.discount > 0 && (!(order as any).clientDiscount || order.discount !== (order as any).clientDiscountAmount) && (
              <div className="flex justify-between text-sm text-green-600">
                <span>Ручная скидка:</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            
            <div className="flex justify-between text-lg font-bold pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="dark:text-white">Итого:</span>
              <span className="text-primary-600">{formatPrice(order.total)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-gray-600 dark:text-gray-400">Статус оплаты:</span>
              <span className={order.paymentStatus === 'paid' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                {order.paymentStatus === 'paid' ? 'Оплачено' : 'Не оплачено'}
              </span>
            </div>
            
            {(order as any).sellerName && (
              <div className="flex justify-between pt-2 text-xs text-gray-400 border-t border-gray-100">
                <span>Продавец:</span>
                <span>{(order as any).sellerName}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Список товаров */}
      <div className="bg-white dark:bg-gray-800 rounded-xl shadow-sm border border-gray-200 dark:border-gray-700 overflow-hidden">
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Package size={20} />
            Состав заказа
          </h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>№</Th>
                <Th>Наименование</Th>
                <Th>Кол-во</Th>
                <Th>Цена</Th>
                <Th>Сумма</Th>
              </Tr>
            </Thead>
            <Tbody>
              {order.items && order.items.length > 0 ? (
                order.items.map((item, idx) => (
                  <Tr key={idx}>
                    <Td className="dark:text-gray-300">{idx + 1}</Td>
                    <Td className="font-medium dark:text-white">{item.productName}</Td>
                    <Td className="dark:text-gray-300">{item.quantity} {(item as any).isWork ? 'н/ч' : 'шт'}</Td>
                    <Td className="dark:text-gray-300">{formatPrice(item.price)}</Td>
                    <Td className="font-semibold dark:text-gray-300">{formatPrice(item.total)}</Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan={5} className="text-center text-gray-500 dark:text-gray-400 py-8">
                    Нет товаров в заказе
                  </Td>
                </Tr>
              )}
            </Tbody>
          </Table>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex justify-end gap-3">
        {(order.documentType === 'receipt' || order.documentType === 'invoice') && (
          <Button
            onClick={handlePrint}
            icon={Printer}
            variant="secondary"
          >
            Распечатать
          </Button>
        )}
      </div>

      {/* Модальные окна */}
      <ReceiptTypeModal
        isOpen={showReceiptTypeModal}
        onClose={() => setShowReceiptTypeModal(false)}
        onSelect={handleReceiptTypeSelect}
      />

      <LegalEntityModal
        isOpen={showLegalEntityModal}
        onClose={() => setShowLegalEntityModal(false)}
        onSubmit={handleLegalEntitySubmit}
      />
    </div>
  );
};

export default OrderDetails;