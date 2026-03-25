// frontend/src/pages/OrderDetails.jsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from '../components/ui/Button';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { formatPrice, formatDate } from '../utils/formatters';
import { 
  ArrowLeft, 
  Printer, 
  FileText, 
  Receipt, 
  CreditCard,
  Download,
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
      const { data } = await saleDocumentsApi.getById(id);
      setOrder(data);
    } catch (error) {
      console.error('Error loading order:', error);
      toast.error('Ошибка загрузки заказа');
      navigate('/sales');
    } finally {
      setLoading(false);
    }
  };

  // Генерация чека
  const generateReceipt = async () => {
    setGenerating(true);
    try {
      // Обновляем статус оплаты
      await saleDocumentsApi.updatePaymentStatus(order.id, 'paid');
      
      // Создаем чек (обновляем тип документа)
      const receiptData = {
        ...order,
        documentType: 'receipt',
        paymentStatus: 'paid'
      };
      
      // Здесь можно вызвать API для обновления документа
      await saleDocumentsApi.update(order.id, receiptData);
      
      toast.success('Чек сформирован');
      loadOrder(); // Перезагружаем заказ
      
      // Печатаем чек
      printDocument('receipt');
      
    } catch (error) {
      console.error('Error generating receipt:', error);
      toast.error('Ошибка формирования чека');
    } finally {
      setGenerating(false);
    }
  };

  // Генерация счета
  const generateInvoice = async () => {
    setGenerating(true);
    try {
      const invoiceData = {
        ...order,
        documentType: 'invoice'
      };
      
      await saleDocumentsApi.update(order.id, invoiceData);
      
      toast.success('Счет сформирован');
      loadOrder();
      
      // Печатаем счет
      printDocument('invoice');
      
    } catch (error) {
      console.error('Error generating invoice:', error);
      toast.error('Ошибка формирования счета');
    } finally {
      setGenerating(false);
    }
  };

  // Печать документа
  const printDocument = (type) => {
    const printWindow = window.open('', '_blank');
    printWindow.document.write(renderDocumentHTML(type));
    printWindow.document.close();
    printWindow.print();
  };

  // Рендер HTML для печати
  const renderDocumentHTML = (type) => {
    const isReceipt = type === 'receipt';
    return `
      <!DOCTYPE html>
      <html>
      <head>
        <title>${isReceipt ? 'Чек' : 'Счет'} №${order.documentNumber}</title>
        <style>
          body { font-family: Arial, sans-serif; padding: 20px; }
          .header { text-align: center; margin-bottom: 30px; }
          .title { font-size: 24px; font-weight: bold; }
          .company { font-size: 12px; color: #666; margin-top: 5px; }
          .info { margin: 20px 0; padding: 15px; background: #f9f9f9; border-radius: 8px; }
          .info-row { display: flex; justify-content: space-between; margin: 5px 0; }
          table { width: 100%; border-collapse: collapse; margin: 20px 0; }
          th, td { border: 1px solid #ddd; padding: 10px; text-align: left; }
          th { background-color: #f2f2f2; }
          .totals { margin-top: 20px; text-align: right; }
          .footer { margin-top: 50px; text-align: center; font-size: 12px; color: #666; }
          .status-paid { color: green; font-weight: bold; }
          .status-unpaid { color: red; font-weight: bold; }
        </style>
      </head>
      <body>
        <div class="header">
          <div class="title">${isReceipt ? 'ЧЕК' : 'СЧЕТ НА ОПЛАТУ'}</div>
          <div class="company">ООО "CRM TUNING"</div>
          <div>ИНН: 1234567890 / КПП: 123456789</div>
          <div>г. Москва, ул. Примерная, д. 1</div>
        </div>
        
        <div class="info">
          <div class="info-row"><strong>№ документа:</strong> ${order.documentNumber}</div>
          <div class="info-row"><strong>Дата:</strong> ${formatDate(order.saleDate)}</div>
          ${order.customerName ? `<div class="info-row"><strong>Покупатель:</strong> ${order.customerName}</div>` : ''}
          ${order.customerPhone ? `<div class="info-row"><strong>Телефон:</strong> ${order.customerPhone}</div>` : ''}
          ${order.customerEmail ? `<div class="info-row"><strong>Email:</strong> ${order.customerEmail}</div>` : ''}
          ${order.customerAddress ? `<div class="info-row"><strong>Адрес:</strong> ${order.customerAddress}</div>` : ''}
        </div>
        
        <table>
          <thead>
            <tr>
              <th>№</th>
              <th>Товар</th>
              <th>Артикул</th>
              <th>Кол-во</th>
              <th>Цена</th>
              <th>Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${order.items.map((item, idx) => `
              <tr>
                <td>${idx + 1}</td>
                <td>${item.productName}</td>
                <td>${item.productArticle}</td>
                <td>${item.quantity} шт.</td>
                <td>${item.price.toLocaleString()} ₽</td>
                <td>${item.total.toLocaleString()} ₽</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        
        <div class="totals">
          <div><strong>Сумма:</strong> ${order.subtotal.toLocaleString()} ₽</div>
          ${order.discount > 0 ? `<div><strong>Скидка:</strong> ${order.discount.toLocaleString()} ₽</div>` : ''}
          <div><strong>Итого к оплате:</strong> ${order.total.toLocaleString()} ₽</div>
          <div class="${order.paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}">
            <strong>Статус:</strong> ${order.paymentStatus === 'paid' ? 'Оплачено' : 'Не оплачено'}
          </div>
        </div>
        
        <div class="footer">
          <p>${isReceipt ? 'Спасибо за покупку!' : 'Оплата по счету в течение 5 банковских дней'}</p>
          <p>${isReceipt ? 'Данный документ является фискальным чеком' : 'Данный документ является основанием для оплаты'}</p>
        </div>
      </body>
      </html>
    `;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  if (!order) return null;

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
            onClick={generateReceipt}
            disabled={generating || order.documentType === 'receipt'}
            icon={Receipt}
            variant="success"
          >
            Чек
          </Button>
          <Button
            onClick={generateInvoice}
            disabled={generating || order.documentType === 'invoice'}
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

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Информация о покупателе */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <User size={20} />
            Информация о покупателе
          </h2>
          <div className="space-y-3">
            {order.customerName && (
              <div className="flex items-center gap-2 text-gray-600">
                <User size={16} />
                <span>{order.customerName}</span>
              </div>
            )}
            {order.customerPhone && (
              <div className="flex items-center gap-2 text-gray-600">
                <Phone size={16} />
                <span>{order.customerPhone}</span>
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
            {!order.customerName && !order.customerPhone && (
              <p className="text-gray-500 text-sm">Данные не указаны</p>
            )}
          </div>
        </div>

        {/* Информация о заказе */}
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
            <Package size={20} />
            Информация о заказе
          </h2>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Номер заказа:</span>
              <span className="font-medium">{order.documentNumber}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Дата создания:</span>
              <span>{formatDate(order.saleDate)}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Способ оплаты:</span>
              <span className="capitalize">
                {order.paymentMethod === 'cash' ? 'Наличные' : 
                 order.paymentMethod === 'card' ? 'Банковская карта' : 
                 'Безналичный перевод'}
              </span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Количество товаров:</span>
              <span>{order.items?.length || 0} шт.</span>
            </div>
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
          </div>
        </div>
      </div>

      {/* Список товаров */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Состав заказа</h2>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <Thead>
              <Tr>
                <Th>№</Th>
                <Th>Товар</Th>
                <Th>Артикул</Th>
                <Th>Кол-во</Th>
                <Th>Цена</Th>
                <Th>Сумма</Th>
              </Tr>
            </Thead>
            <Tbody>
              {order.items?.map((item, idx) => (
                <Tr key={idx}>
                  <Td>{idx + 1}</Td>
                  <Td className="font-medium">{item.productName}</Td>
                  <Td className="text-xs text-gray-500">{item.productArticle}</Td>
                  <Td>{item.quantity} шт.</Td>
                  <Td>{formatPrice(item.price)}</Td>
                  <Td className="font-semibold">{formatPrice(item.total)}</Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex justify-end gap-3">
        <Button
          onClick={() => printDocument(order.documentType || 'receipt')}
          icon={Printer}
          variant="secondary"
        >
          Распечатать
        </Button>
        {order.paymentStatus !== 'paid' && (
          <Button
            onClick={generateReceipt}
            icon={CreditCard}
            variant="success"
          >
            Отметить как оплаченный
          </Button>
        )}
      </div>
    </div>
  );
};