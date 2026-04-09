// frontend/src/pages/ClientDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsApi } from '../api/clients';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { formatPrice, formatDate } from '../utils/formatters';
import { ArrowLeft, Phone, Mail, MapPin, Car, ShoppingBag, Calendar, CreditCard, Plus, Percent, Edit2, Save, X } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  middleName?: string;
  phone: string;
  email?: string;
  city?: string;
  carModel?: string;
  carYear?: number;
  carNumber?: string;
  createdAt: string;
  discountPercent?: number;
  notes?: string;
}

interface Order {
  id: number;
  documentNumber: string;
  total: number;
  paymentStatus: string;
  saleDate: string;
  items: Array<{
    productName: string;
    quantity: number;
    price: number;
    total: number;
  }>;
}

export const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showDiscountModal, setShowDiscountModal] = useState<boolean>(false);
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [updatingDiscount, setUpdatingDiscount] = useState<boolean>(false);
  
  // 🆕 Состояния для редактирования примечаний
  const [isEditingNotes, setIsEditingNotes] = useState<boolean>(false);
  const [editingNotes, setEditingNotes] = useState<string>('');
  const [updatingNotes, setUpdatingNotes] = useState<boolean>(false);

  useEffect(() => {
    if (id) {
      loadClientData(parseInt(id));
    }
  }, [id]);

  const loadClientData = async (clientId: number) => {
    try {
      setLoading(true);
      const [clientRes, ordersRes] = await Promise.all([
        clientsApi.getById(clientId),
        saleDocumentsApi.getByClientId(clientId)
      ]);
      setClient(clientRes.data);
      setDiscountPercent(clientRes.data.discountPercent || 0);
      setEditingNotes(clientRes.data.notes || '');
      setOrders(ordersRes.data || []);
    } catch (error) {
      console.error('Error loading client data:', error);
      toast.error('Ошибка загрузки данных клиента');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  const handleUpdateDiscount = async () => {
    if (!client) return;
    
    setUpdatingDiscount(true);
    try {
      await clientsApi.updateDiscount(client.id, discountPercent);
      setClient({ ...client, discountPercent });
      toast.success(`Скидка клиента изменена на ${discountPercent}%`);
      setShowDiscountModal(false);
    } catch (error) {
      console.error('Error updating discount:', error);
      toast.error('Ошибка обновления скидки');
    } finally {
      setUpdatingDiscount(false);
    }
  };

  // 🆕 Функция обновления примечаний
  const handleUpdateNotes = async () => {
    if (!client) return;
    
    setUpdatingNotes(true);
    try {
      // Обновляем только поле notes
      const updateData = { notes: editingNotes };
      await clientsApi.update(client.id, updateData);
      setClient({ ...client, notes: editingNotes });
      toast.success('Примечания обновлены');
      setIsEditingNotes(false);
    } catch (error) {
      console.error('Error updating notes:', error);
      toast.error('Ошибка обновления примечаний');
    } finally {
      setUpdatingNotes(false);
    }
  };

  const getFullName = (): string => {
    if (!client) return '';
    const parts = [client.lastName, client.firstName, client.middleName].filter(Boolean);
    return parts.join(' ') || 'Без имени';
  };

  const paidOrders = orders.filter(order => order.paymentStatus === 'paid');
  const getTotalSpent = (): number => paidOrders.reduce((sum, order) => sum + order.total, 0);
  const getAverageCheck = (): number => paidOrders.length === 0 ? 0 : getTotalSpent() / paidOrders.length;
  const getUnpaidCount = (): number => orders.filter(order => order.paymentStatus !== 'paid').length;
  const getUnpaidTotal = (): number => orders.filter(order => order.paymentStatus !== 'paid').reduce((sum, order) => sum + order.total, 0);

  const handleNewOrder = () => navigate(`/sales/new?clientId=${client?.id}`);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!client) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">Клиент не найден</p>
        <Button onClick={() => navigate('/clients')} className="mt-4">
          Вернуться к списку
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <button
          onClick={() => navigate('/clients')}
          className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
        >
          <ArrowLeft size={20} />
          Назад к списку
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <div className="flex justify-between items-start">
              <div>
                <h2 className="text-xl font-semibold text-gray-900">{getFullName()}</h2>
                <p className="text-sm text-gray-500">Клиент с {formatDate(client.createdAt)}</p>
              </div>
              <div className="flex items-center gap-2">
                {client.discountPercent && client.discountPercent > 0 ? (
                  <span className="inline-flex items-center gap-1 px-3 py-1.5 bg-green-100 text-green-700 rounded-full text-sm font-medium">
                    <Percent size={14} />
                    Скидка {client.discountPercent}%
                  </span>
                ) : (
                  <span className="text-sm text-gray-400">Нет скидки</span>
                )}
                <button
                  onClick={() => {
                    setDiscountPercent(client.discountPercent || 0);
                    setShowDiscountModal(true);
                  }}
                  className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Изменить скидку"
                >
                  <Edit2 size={16} />
                </button>
              </div>
            </div>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="flex items-center gap-3">
                <Phone size={18} className="text-gray-400" />
                <div>
                  <p className="text-sm text-gray-500">Телефон</p>
                  <p className="font-medium">{client.phone}</p>
                </div>
              </div>
              {client.email && (
                <div className="flex items-center gap-3">
                  <Mail size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Email</p>
                    <p className="font-medium">{client.email}</p>
                  </div>
                </div>
              )}
              {client.city && (
                <div className="flex items-center gap-3">
                  <MapPin size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Город</p>
                    <p className="font-medium">{client.city}</p>
                  </div>
                </div>
              )}
              {client.carModel && (
                <div className="flex items-center gap-3">
                  <Car size={18} className="text-gray-400" />
                  <div>
                    <p className="text-sm text-gray-500">Автомобиль</p>
                    <p className="font-medium">
                      {client.carModel}
                      {client.carYear && `, ${client.carYear}`}
                      {client.carNumber && ` (${client.carNumber})`}
                    </p>
                  </div>
                </div>
              )}
            </div>

            {/* 🆕 Блок с примечаниями с возможностью редактирования */}
            <div className="mt-4 pt-4 border-t border-gray-100">
              <div className="flex items-start gap-3">
                <div className="text-gray-400 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
                    <polyline points="14 2 14 8 20 8"/>
                    <line x1="16" y1="13" x2="8" y2="13"/>
                    <line x1="16" y1="17" x2="8" y2="17"/>
                    <polyline points="10 9 9 9 8 9"/>
                  </svg>
                </div>
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-2">
                    <p className="text-sm text-gray-500">Примечания</p>
                    {!isEditingNotes && (
                      <button
                        onClick={() => {
                          setEditingNotes(client.notes || '');
                          setIsEditingNotes(true);
                        }}
                        className="p-1 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
                        title="Редактировать примечания"
                      >
                        <Edit2 size={14} />
                      </button>
                    )}
                  </div>
                  
                  {isEditingNotes ? (
                    <div className="space-y-3">
                      <textarea
                        value={editingNotes}
                        onChange={(e) => setEditingNotes(e.target.value)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                        rows={4}
                        placeholder="Дополнительная информация о клиенте..."
                        autoFocus
                      />
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          onClick={handleUpdateNotes}
                          loading={updatingNotes}
                          icon={Save}
                        >
                          Сохранить
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => {
                            setIsEditingNotes(false);
                            setEditingNotes(client.notes || '');
                          }}
                          icon={X}
                        >
                          Отмена
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <p className="text-gray-700 whitespace-pre-wrap">
                      {client.notes || <span className="text-gray-400 italic">Нет примечаний</span>}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </CardBody>
        </Card>

        <Card>
          <CardHeader>
            <h3 className="font-semibold text-gray-900">Статистика</h3>
          </CardHeader>
          <CardBody className="space-y-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-primary-600">{getTotalSpent().toLocaleString()} ₽</p>
              <p className="text-sm text-gray-500">Всего потрачено</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-gray-900">{paidOrders.length}</p>
              <p className="text-sm text-gray-500">Оплаченных заказов</p>
            </div>
            <div className="text-center">
              <p className="text-xl font-semibold text-green-600">{getAverageCheck().toLocaleString()} ₽</p>
              <p className="text-sm text-gray-500">Средний чек</p>
            </div>
            {getUnpaidCount() > 0 && (
              <div className="text-center pt-2 border-t border-gray-100">
                <div className="flex items-center justify-center gap-2 text-yellow-600">
                  <CreditCard size={16} />
                  <p className="text-sm">
                    Неоплачено: {getUnpaidCount()} заказов на {getUnpaidTotal().toLocaleString()} ₽
                  </p>
                </div>
              </div>
            )}
          </CardBody>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <div className="flex justify-between items-center">
            <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <ShoppingBag size={20} />
              История заказов
              {getUnpaidCount() > 0 && (
                <span className="text-sm font-normal text-yellow-600 ml-2">
                  ({getUnpaidCount()} неоплаченных)
                </span>
              )}
            </h3>
            <Button onClick={handleNewOrder} icon={Plus} variant="secondary" size="sm">
              Новый заказ
            </Button>
          </div>
        </CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-500">У клиента пока нет заказов</p>
              <Button onClick={handleNewOrder} variant="primary" className="mt-4">
                Создать первый заказ
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {orders.map((order) => (
                <div
                  key={order.id}
                  onClick={() => navigate(`/sales/${order.id}`)}
                  className="border rounded-lg p-4 hover:bg-gray-50 cursor-pointer transition-colors"
                >
                  <div className="flex justify-between items-start mb-2">
                    <div>
                      <p className="font-medium text-gray-900">{order.documentNumber}</p>
                      <p className="text-sm text-gray-500 flex items-center gap-1">
                        <Calendar size={14} />
                        {formatDate(order.saleDate)}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className={`font-bold ${order.paymentStatus === 'paid' ? 'text-primary-600' : 'text-gray-400'}`}>
                        {formatPrice(order.total)}
                      </p>
                      <p className={`text-xs px-2 py-0.5 rounded-full ${
                        order.paymentStatus === 'paid' 
                          ? 'bg-green-100 text-green-700' 
                          : 'bg-yellow-100 text-yellow-700'
                      }`}>
                        {order.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен'}
                      </p>
                    </div>
                  </div>
                  <div className="text-sm text-gray-600">
                    {order.items.length} товаров
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Модалка изменения скидки */}
      <Modal
        isOpen={showDiscountModal}
        onClose={() => setShowDiscountModal(false)}
        title="Персональная скидка клиента"
        size="sm"
      >
        <div className="space-y-4">
          <div className="text-center">
            <p className="text-sm text-gray-500 mb-2">Текущая скидка</p>
            <p className="text-3xl font-bold text-green-600">{discountPercent}%</p>
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Изменить скидку
            </label>
            <div className="flex items-center gap-3">
              <input
                type="range"
                min="0"
                max="100"
                step="1"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(parseInt(e.target.value))}
                className="flex-1 h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-green-600"
              />
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, parseInt(e.target.value) || 0)))}
                className="w-20 px-2 py-1 text-center border rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="0"
                max="100"
                step="1"
              />
              <span className="text-sm text-gray-500">%</span>
            </div>
          </div>
          
          <p className="text-xs text-gray-400">
            Скидка будет автоматически применяться ко всем новым заказам этого клиента
          </p>
          
          <div className="flex justify-end gap-3 pt-4 border-t">
            <Button variant="secondary" onClick={() => setShowDiscountModal(false)}>
              Отмена
            </Button>
            <Button onClick={handleUpdateDiscount} loading={updatingDiscount}>
              Сохранить
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
};

export default ClientDetails;