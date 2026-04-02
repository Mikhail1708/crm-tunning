// frontend/src/pages/ClientDetails.tsx
import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { ArrowLeft, Edit2, Phone, Mail, MapPin, Calendar, Car, CreditCard, Package } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clientsApi } from '../api/clients';
import { Button } from '../components/ui/Button';
import { Card } from '../components/ui/Card';
import { formatDate, formatPrice } from '../utils/formatters';
import { Client } from '../types';

const ClientDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [client, setClient] = useState<Client | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

  useEffect(() => {
    fetchClient();
  }, [id]);

  const fetchClient = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await clientsApi.getById(Number(id));
      setClient(response.data);
    } catch (error) {
      console.error('Error fetching client:', error);
      toast.error('Ошибка загрузки данных клиента');
      navigate('/clients');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return <div className="p-6 text-center">Загрузка...</div>;
  }

  if (!client) {
    return <div className="p-6 text-center">Клиент не найден</div>;
  }

  const fullName = [client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ');

  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <button onClick={() => navigate('/clients')} className="p-2 hover:bg-gray-100 rounded-lg">
          <ArrowLeft className="w-5 h-5" />
        </button>
        <h1 className="text-2xl font-bold">{fullName}</h1>
        <Button onClick={() => navigate('/sales/new', { state: { clientId: client.id } })}>
          <Package className="w-4 h-4 mr-2" />
          Новый заказ
        </Button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Основная информация */}
        <Card className="lg:col-span-2 p-6">
          <h2 className="text-lg font-semibold mb-4">Информация о клиенте</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="flex items-center gap-3">
              <Phone className="w-5 h-5 text-gray-400" />
              <div>
                <div className="text-sm text-gray-500">Телефон</div>
                <div className="font-medium">{client.phone}</div>
              </div>
            </div>
            {client.email && (
              <div className="flex items-center gap-3">
                <Mail className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Email</div>
                  <div className="font-medium">{client.email}</div>
                </div>
              </div>
            )}
            {client.birthDate && (
              <div className="flex items-center gap-3">
                <Calendar className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Дата рождения</div>
                  <div className="font-medium">{formatDate(client.birthDate)}</div>
                </div>
              </div>
            )}
            {(client.address || client.city) && (
              <div className="flex items-center gap-3">
                <MapPin className="w-5 h-5 text-gray-400" />
                <div>
                  <div className="text-sm text-gray-500">Адрес</div>
                  <div className="font-medium">{client.city} {client.address}</div>
                </div>
              </div>
            )}
          </div>
        </Card>

        {/* Статистика */}
        <Card className="p-6">
          <h2 className="text-lg font-semibold mb-4">Статистика</h2>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-gray-500">Всего заказов</div>
              <div className="text-2xl font-bold">{client.totalOrders}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Общая сумма покупок</div>
              <div className="text-2xl font-bold text-blue-600">{formatPrice(client.totalSpent || 0)}</div>
            </div>
            <div>
              <div className="text-sm text-gray-500">Средний чек</div>
              <div className="text-xl font-semibold">
                {client.totalOrders && client.totalOrders > 0 ? formatPrice((client.totalSpent || 0) / client.totalOrders) : '0 ₽'}
              </div>
            </div>
          </div>
        </Card>

        {/* Информация об автомобиле */}
        {(client.carModel || client.carNumber || client.carVin) && (
          <Card className="lg:col-span-3 p-6">
            <h2 className="text-lg font-semibold mb-4">Автомобиль</h2>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div>
                <div className="text-sm text-gray-500">Модель</div>
                <div className="font-medium">{client.carModel || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Год выпуска</div>
                <div className="font-medium">{client.carYear || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">Госномер</div>
                <div className="font-medium">{client.carNumber || '-'}</div>
              </div>
              <div>
                <div className="text-sm text-gray-500">VIN номер</div>
                <div className="font-medium font-mono text-sm">{client.carVin || '-'}</div>
              </div>
            </div>
          </Card>
        )}

        {/* История заказов */}
        <Card className="lg:col-span-3 p-6">
          <h2 className="text-lg font-semibold mb-4">История заказов</h2>
          {client.orders && client.orders.length > 0 ? (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Номер</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Дата</th>
                    <th className="px-4 py-2 text-right text-sm font-medium text-gray-600">Сумма</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Статус</th>
                    <th className="px-4 py-2 text-left text-sm font-medium text-gray-600">Тип</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {client.orders.map(order => (
                    <tr
                      key={order.id}
                      className="hover:bg-gray-50 cursor-pointer"
                      onClick={() => navigate(`/sales/${order.id}`)}
                    >
                      <td className="px-4 py-2 font-mono text-sm">{order.documentNumber}</td>
                      <td className="px-4 py-2 text-sm">{formatDate(order.saleDate)}</td>
                      <td className="px-4 py-2 text-right font-medium">{formatPrice(order.total)}</td>
                      <td className="px-4 py-2">
                        <span className={`px-2 py-1 rounded-full text-xs ${
                          order.paymentStatus === 'paid' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'
                        }`}>
                          {order.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен'}
                        </span>
                      </td>
                      <td className="px-4 py-2 text-sm">
                        {order.documentType === 'order' ? 'Заказ' : order.documentType === 'receipt' ? 'Чек' : 'Счет'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="text-center py-8 text-gray-500">У клиента пока нет заказов</div>
          )}
        </Card>
      </div>
    </div>
  );
};

export default ClientDetails;