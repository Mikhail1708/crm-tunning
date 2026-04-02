// frontend/src/pages/ClientDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { clientsApi } from '../api/clients';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { formatPrice, formatDate } from '../utils/formatters';
import { ArrowLeft, Phone, Mail, MapPin, Car, ShoppingBag, Calendar } from 'lucide-react';
import toast from 'react-hot-toast';

interface Client {
  id: number;
  firstName: string;
  lastName: string;
  phone: string;
  email?: string;
  city?: string;
  carModel?: string;
  carYear?: number;
  carNumber?: string;
  createdAt: string;
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
      setOrders(ordersRes.data || []);
    } catch (error) {
      console.error('Error loading client data:', error);
      toast.error('Ошибка загрузки данных клиента');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  const getFullName = (): string => {
    if (!client) return '';
    return `${client.firstName} ${client.lastName}`;
  };

  const getTotalSpent = (): number => {
    return orders.reduce((sum, order) => sum + order.total, 0);
  };

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
      {/* Кнопка назад */}
      <button
        onClick={() => navigate('/clients')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
      >
        <ArrowLeft size={20} />
        Назад к списку
      </button>

      {/* Информация о клиенте */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <h2 className="text-xl font-semibold text-gray-900">{getFullName()}</h2>
            <p className="text-sm text-gray-500">Клиент с {formatDate(client.createdAt)}</p>
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
          </CardBody>
        </Card>

        {/* Статистика */}
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
              <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
              <p className="text-sm text-gray-500">Заказов</p>
            </div>
          </CardBody>
        </Card>
      </div>

      {/* История заказов */}
      <Card>
        <CardHeader>
          <h3 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <ShoppingBag size={20} />
            История заказов
          </h3>
        </CardHeader>
        <CardBody>
          {orders.length === 0 ? (
            <p className="text-center text-gray-500 py-8">У клиента пока нет заказов</p>
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
                      <p className="font-bold text-primary-600">{formatPrice(order.total)}</p>
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
    </div>
  );
};

export default ClientDetails;