// frontend/src/pages/OrderDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from '../components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { formatPrice, formatDate } from '../utils/formatters';
import { PrintDocument } from '../components/ui/PrintDocument';
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
  XCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export const OrderDetails = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [order, setOrder] = useState(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    loadOrder();
  }, [id]);

  const loadOrder = async () => {
    try {
      setLoading(true);
      const response = await saleDocumentsApi.getById(id);
      setOrder(response.data);
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Ошибка загрузки заказа');
      navigate('/sales');
    } finally {
      setLoading(false);
    }
  };

  // frontend/src/pages/OrderDetails.jsx
// Остальной код такой же, меняем только функции:

  // Генерация и печать чека
  const handlePrintReceipt = async () => {
    setGenerating(true);
    try {
      // Обновляем статус оплаты (используем PUT /:id/payment)
      await saleDocumentsApi.updatePaymentStatus(order.id, 'paid');
      
      // Обновляем тип документа
      await saleDocumentsApi.update(order.id, { documentType: 'receipt' });
      
      // Обновляем локальный state
      const updatedOrder = { ...order, paymentStatus: 'paid', documentType: 'receipt' };
      setOrder(updatedOrder);
      
      toast.success('Чек сформирован');
      
      // Печатаем чек
      const printWindow = window.open('', '_blank');
      const { renderHTML } = PrintDocument({ order: updatedOrder, type: 'receipt' });
      printWindow.document.write(renderHTML());
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Ошибка формирования чека');
    } finally {
      setGenerating(false);
    }
  };

  // Генерация и печать счета
  const handlePrintInvoice = async () => {
    setGenerating(true);
    try {
      // Обновляем тип документа
      await saleDocumentsApi.update(order.id, { documentType: 'invoice' });
      
      // Обновляем локальный state
      const updatedOrder = { ...order, documentType: 'invoice' };
      setOrder(updatedOrder);
      
      toast.success('Счет сформирован');
      
      // Печатаем счет
      const printWindow = window.open('', '_blank');
      const { renderHTML } = PrintDocument({ order: updatedOrder, type: 'invoice' });
      printWindow.document.write(renderHTML());
      printWindow.document.close();
      printWindow.print();
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Ошибка формирования счета');
    } finally {
      setGenerating(false);
    }
  };

  // Просто печать текущего документа
  const handlePrint = () => {
    if (!order) return;
    
    const type = order.documentType === 'receipt' ? 'receipt' : 'invoice';
    const printWindow = window.open('', '_blank');
    const { renderHTML } = PrintDocument({ order, type });
    printWindow.document.write(renderHTML());
    printWindow.document.close();
    printWindow.print();
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
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/sales')}
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900">
              Заказ №{order.documentNumber}
            </h1>
            <p className="text-gray-500 mt-1">
              Создан {formatDate(order.saleDate)}
            </p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            onClick={handlePrintReceipt}
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

      {/* Статус заказа */}
      <div className={`p-4 rounded-lg ${
        order.paymentStatus === 'paid' 
          ? 'bg-green-50 border border-green-200' 
          : 'bg-yellow-50 border border-yellow-200'
      }`}>
        <div className="flex items-center gap-2">
          {order.paymentStatus === 'paid' ? (
            <CheckCircle className="text-green-600" size={20} />
          ) : (
            <XCircle className="text-yellow-600" size={20} />
          )}
          <span className={`font-medium ${
            order.paymentStatus === 'paid' ? 'text-green-700' : 'text-yellow-700'
          }`}>
            {order.paymentStatus === 'paid' ? 'Заказ оплачен' : 'Заказ ожидает оплаты'}
          </span>
          {order.documentType === 'receipt' && (
            <span className="ml-2 px-2 py-1 bg-green-100 text-green-700 text-xs rounded-full">
              Чек выдан
            </span>
          )}
          {order.documentType === 'invoice' && (
            <span className="ml-2 px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
              Счет выставлен
            </span>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Информация о покупателе */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User size={20} />
            Информация о покупателе
          </h2>
          <div className="space-y-3">
            {(order.customerName || order.clientName) && (
              <div className="flex items-center gap-2 text-gray-600">
                <User size={16} />
                <span>{order.customerName || order.clientName}</span>
              </div>
            )}
            {(order.customerPhone || order.clientPhone) && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone size={16} />
                <span>{order.customerPhone || order.clientPhone}</span>
              </div>
            )}
            {order.customerEmail && (
              <div className="flex items-center gap-2 text-gray-600">
                <Mail size={16} />
                <span>{order.customerEmail}</span>
              </div>
            )}
            {order.customerAddress && (
              <div className="flex items-center gap-2 text-gray-600">
                <MapPin size={16} />
                <span>{order.customerAddress}</span>
              </div>
            )}
            {!order.customerName && !order.clientName && !order.customerPhone && (
              <p className="text-gray-500 text-sm">Данные не указаны</p>
            )}
          </div>
        </div>

        {/* Итоги */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <DollarSign size={20} />
            Итоги заказа
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Сумма:</span>
              <span>{formatPrice(order.subtotal)}</span>
            </div>
            {order.discount > 0 && (
              <div className="flex justify-between text-green-600">
                <span>Скидка:</span>
                <span>-{formatPrice(order.discount)}</span>
              </div>
            )}
            <div className="flex justify-between text-lg font-bold pt-2 border-t">
              <span>Итого:</span>
              <span className="text-primary-600">{formatPrice(order.total)}</span>
            </div>
            <div className="flex justify-between pt-2">
              <span className="text-gray-600">Статус оплаты:</span>
              <span className={order.paymentStatus === 'paid' ? 'text-green-600 font-medium' : 'text-yellow-600 font-medium'}>
                {order.paymentStatus === 'paid' ? 'Оплачено' : 'Не оплачено'}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Список товаров */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
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
                    <Td>{idx + 1}</Td>
                    <Td className="font-medium">{item.productName}</Td>
                    <Td>{item.quantity} {item.isWork ? 'н/ч' : 'шт'}</Td>
                    <Td>{formatPrice(item.price)}</Td>
                    <Td className="font-semibold">{formatPrice(item.total)}</Td>
                  </Tr>
                ))
              ) : (
                <Tr>
                  <Td colSpan="5" className="text-center text-gray-500 py-8">
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
        {order.paymentStatus !== 'paid' && (
          <Button
            onClick={handlePrintReceipt}
            icon={CreditCard}
            variant="success"
            disabled={generating}
          >
            {generating ? 'Обработка...' : 'Отметить как оплаченный'}
          </Button>
        )}
      </div>
    </div>
  );
};