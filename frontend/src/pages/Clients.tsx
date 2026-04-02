// frontend/src/pages/Clients.tsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search, Edit2, Trash2, User, Phone, Mail, Car, ChevronLeft, ChevronRight, Calendar, MapPin } from 'lucide-react';
import { toast } from 'react-hot-toast';
import { clientsApi } from '../api/clients';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Card } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Client, PaginatedResponse } from '../types';
import { formatDate, formatPrice } from '../utils/formatters';

interface ClientFormData {
  firstName: string;
  lastName: string;
  middleName: string;
  phone: string;
  email: string;
  birthDate: string;
  city: string;
  carModel: string;
  carYear: string;
  carNumber: string;
  notes: string;
}

interface ClientsStats {
  totalClients: number;
  totalSpent: number;
  newClientsThisMonth: number;
  topClients: Client[];
}

// Функция валидации телефона
const validatePhone = (phone: string): string | null => {
  if (!phone) return 'Телефон обязателен';
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 0) return 'Введите номер телефона';
  if (digits.length < 10) return 'Номер телефона должен содержать минимум 10 цифр';
  if (digits.length > 12) return 'Номер телефона слишком длинный';
  
  return null;
};

// Функция форматирования телефона
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  if (digits.length <= 1) return `+7`;
  if (digits.length <= 4) return `+7 (${digits.slice(1, 4)}`;
  if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}`;
  if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}`;
  
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
};

export const Clients: React.FC = () => {
  const navigate = useNavigate();
  const [clients, setClients] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [search, setSearch] = useState<string>('');
  const [sortBy, setSortBy] = useState<string>('createdAt');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [page, setPage] = useState<number>(1);
  const [total, setTotal] = useState<number>(0);
  const [limit] = useState<number>(20);
  const [showDeleteModal, setShowDeleteModal] = useState<boolean>(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [showClientModal, setShowClientModal] = useState<boolean>(false);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [carYearError, setCarYearError] = useState<string>('');
  const [phoneError, setPhoneError] = useState<string>('');
  const [formData, setFormData] = useState<ClientFormData>({
    firstName: '',
    lastName: '',
    middleName: '',
    phone: '',
    email: '',
    birthDate: '',
    city: '',
    carModel: '',
    carYear: '',
    carNumber: '',
    notes: ''
  });
  const [stats, setStats] = useState<ClientsStats | null>(null);

  useEffect(() => {
    fetchClients();
    fetchStats();
  }, [search, sortBy, sortOrder, page]);

  const fetchClients = async (): Promise<void> => {
    setLoading(true);
    try {
      const response = await clientsApi.getAll({
        search,
        sortBy,
        sortOrder,
        page,
        limit
      });
      setClients(response.data.data.clients);
      setTotal(response.data.data.total);
    } catch (error) {
      console.error('Error fetching clients:', error);
      toast.error('Ошибка загрузки клиентов');
    } finally {
      setLoading(false);
    }
  };

  const fetchStats = async (): Promise<void> => {
    try {
      const response = await clientsApi.getStats();
      setStats(response.data);
    } catch (error) {
      console.error('Error fetching stats:', error);
    }
  };

  const handleDelete = async (): Promise<void> => {
    if (!selectedClient) return;
    
    try {
      await clientsApi.delete(selectedClient.id);
      toast.success('Клиент удален');
      setShowDeleteModal(false);
      fetchClients();
      fetchStats();
    } catch (error) {
      console.error('Error deleting client:', error);
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Ошибка удаления');
    }
  };

  const validateCarYear = (year: string): boolean => {
    if (!year) return true;
    const yearNum = parseInt(year);
    if (isNaN(yearNum)) return false;
    return yearNum >= 1970 && yearNum <= 2100;
  };

  const handleCarYearChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const value = e.target.value;
    setFormData({ ...formData, carYear: value });
    
    if (value && !validateCarYear(value)) {
      setCarYearError('Год должен быть от 1970 до 2100');
    } else {
      setCarYearError('');
    }
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const rawValue = e.target.value;
    const formattedValue = formatPhone(rawValue);
    setFormData({ ...formData, phone: formattedValue });
    
    const error = validatePhone(formattedValue);
    setPhoneError(error || '');
  };

  const handleSaveClient = async (): Promise<void> => {
    const phoneValidationError = validatePhone(formData.phone);
    if (phoneValidationError) {
      toast.error(phoneValidationError);
      return;
    }
    
    if (formData.carYear && !validateCarYear(formData.carYear)) {
      toast.error('Год выпуска должен быть от 1970 до 2100');
      return;
    }
    
    if (!formData.firstName) {
      toast.error('Имя обязательно для заполнения');
      return;
    }
    
    const cleanPhone = formData.phone.replace(/\D/g, '');
    
    const clientData = {
      ...formData,
      phone: cleanPhone
    };
    
    try {
      if (editingClient) {
        await clientsApi.update(editingClient.id, clientData);
        toast.success('Клиент обновлен');
      } else {
        await clientsApi.create(clientData);
        toast.success('Клиент создан');
      }
      setShowClientModal(false);
      setEditingClient(null);
      setCarYearError('');
      setPhoneError('');
      setFormData({
        firstName: '', lastName: '', middleName: '', phone: '', email: '',
        birthDate: '', city: '', carModel: '', carYear: '', carNumber: '', notes: ''
      });
      fetchClients();
      fetchStats();
    } catch (error) {
      console.error('Error saving client:', error);
      toast.error((error as { response?: { data?: { error?: string } } }).response?.data?.error || 'Ошибка сохранения');
    }
  };

  const openEditModal = (client: Client): void => {
    setEditingClient(client);
    const formattedPhone = client.phone ? formatPhone(client.phone) : '';
    setFormData({
      firstName: client.firstName || '',
      lastName: client.lastName || '',
      middleName: client.middleName || '',
      phone: formattedPhone,
      email: client.email || '',
      birthDate: client.birthDate ? client.birthDate.split('T')[0] : '',
      city: client.city || '',
      carModel: client.carModel || '',
      carYear: client.carYear || '',
      carNumber: client.carNumber || '',
      notes: client.notes || ''
    });
    setCarYearError('');
    setPhoneError('');
    setShowClientModal(true);
  };

  const totalPages = Math.ceil(total / limit);

  const getFullName = (client: Client): string => {
    const parts = [client.lastName, client.firstName, client.middleName].filter(Boolean);
    return parts.join(' ') || 'Без имени';
  };

  const formatDisplayPhone = (phone: string): string => {
    if (!phone) return '';
    return formatPhone(phone);
  };

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <h1 className="text-2xl font-bold">Клиенты</h1>
        <Button onClick={() => {
          setEditingClient(null);
          setCarYearError('');
          setPhoneError('');
          setFormData({
            firstName: '', lastName: '', middleName: '', phone: '', email: '',
            birthDate: '', city: '', carModel: '', carYear: '', carNumber: '', notes: ''
          });
          setShowClientModal(true);
        }}>
          <Plus className="w-4 h-4 mr-2" />
          Добавить клиента
        </Button>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <div className="text-sm text-gray-500">Всего клиентов</div>
            <div className="text-2xl font-bold">{stats.totalClients}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Общая выручка</div>
            <div className="text-2xl font-bold">{formatPrice(stats.totalSpent)}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Новых за месяц</div>
            <div className="text-2xl font-bold">{stats.newClientsThisMonth}</div>
          </Card>
          <Card className="p-4">
            <div className="text-sm text-gray-500">Топ клиентов</div>
            <div className="text-lg font-semibold truncate">
              {stats.topClients[0]?.firstName || '-'}
            </div>
          </Card>
        </div>
      )}

      {/* Поиск и сортировка */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="flex-1 min-w-[200px]">
          <Input
            placeholder="Поиск по имени, телефону, городу, авто..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            icon={Search}
          />
        </div>
        <select
          className="px-3 py-2 border rounded-lg"
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="createdAt">Дата регистрации</option>
          <option value="totalSpent">Сумма покупок</option>
          <option value="totalOrders">Количество заказов</option>
          <option value="lastName">Фамилия</option>
          <option value="city">Город</option>
        </select>
        <select
          className="px-3 py-2 border rounded-lg"
          value={sortOrder}
          onChange={(e) => setSortOrder(e.target.value as 'asc' | 'desc')}
        >
          <option value="desc">По убыванию</option>
          <option value="asc">По возрастанию</option>
        </select>
      </div>

      {/* Таблица клиентов */}
      <Card className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Клиент</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Контакты</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Город</th>
                <th className="px-4 py-3 text-left text-sm font-medium text-gray-600">Автомобиль</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Заказов</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">На сумму</th>
                <th className="px-4 py-3 text-right text-sm font-medium text-gray-600">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {loading ? (
                <tr><td colSpan={7} className="text-center py-8">Загрузка...</td></tr>
              ) : clients.length === 0 ? (
                <tr><td colSpan={7} className="text-center py-8 text-gray-500">Нет клиентов</td></tr>
              ) : (
                clients.map(client => (
                  <tr
                    key={client.id}
                    className="hover:bg-gray-50 cursor-pointer"
                    onClick={() => navigate(`/clients/${client.id}`)}
                  >
                    <td className="px-4 py-3">
                      <div className="font-medium">{getFullName(client)}</div>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <Phone className="w-3 h-3" />
                        <span>{formatDisplayPhone(client.phone)}</span>
                      </div>
                      {client.email && (
                        <div className="flex items-center gap-1 text-sm text-gray-500">
                          <Mail className="w-3 h-3" />
                          <span>{client.email}</span>
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {client.city ? (
                        <div className="flex items-center gap-1 text-sm">
                          <MapPin className="w-3 h-3 text-gray-400" />
                          <span>{client.city}</span>
                        </div>
                      ) : (
                        <span className="text-gray-400 text-sm">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      {client.carModel && (
                        <div className="flex items-center gap-1 text-sm">
                          <Car className="w-3 h-3" />
                          <span>{client.carModel}</span>
                          {client.carNumber && <span className="text-gray-500">({client.carNumber})</span>}
                          {client.carYear && <span className="text-gray-500 ml-1">{client.carYear} г.</span>}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right">{client.totalOrders}</td>
                    <td className="px-4 py-3 text-right font-medium">{formatPrice(client.totalSpent || 0)}</td>
                    <td className="px-4 py-3 text-right" onClick={(e) => e.stopPropagation()}>
                      <div className="flex justify-end gap-2">
                        <button
                          onClick={() => openEditModal(client)}
                          className="p-1 hover:bg-gray-100 rounded"
                        >
                          <Edit2 className="w-4 h-4 text-gray-500" />
                        </button>
                        <button
                          onClick={() => {
                            setSelectedClient(client);
                            setShowDeleteModal(true);
                          }}
                          className="p-1 hover:bg-red-100 rounded"
                        >
                          <Trash2 className="w-4 h-4 text-red-500" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
        
        {/* Пагинация */}
        {totalPages > 1 && (
          <div className="flex justify-between items-center px-4 py-3 border-t">
            <div className="text-sm text-gray-500">
              {`${(page - 1) * limit + 1}-${Math.min(page * limit, total)} из ${total}`}
            </div>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                <ChevronLeft className="w-4 h-4" />
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setPage(p => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                <ChevronRight className="w-4 h-4" />
              </Button>
            </div>
          </div>
        )}
      </Card>

      {/* Модалка удаления */}
      <Modal
        isOpen={showDeleteModal}
        onClose={() => setShowDeleteModal(false)}
        title="Удаление клиента"
      >
        <p className="mb-4">
          Вы уверены, что хотите удалить клиента <strong>{selectedClient?.firstName} {selectedClient?.lastName}</strong>?
          {selectedClient && selectedClient.totalOrders && selectedClient.totalOrders > 0 && (
            <span className="text-red-500 block mt-2">
              Внимание! У клиента есть заказы. Удаление невозможно.
            </span>
          )}
        </p>
        <div className="flex justify-end gap-3">
          <Button variant="secondary" onClick={() => setShowDeleteModal(false)}>Отмена</Button>
          <Button variant="danger" onClick={handleDelete} disabled={selectedClient && (selectedClient.totalOrders || 0) > 0}>
            Удалить
          </Button>
        </div>
      </Modal>

      {/* Модалка создания/редактирования */}
      <Modal
        isOpen={showClientModal}
        onClose={() => setShowClientModal(false)}
        title={editingClient ? 'Редактирование клиента' : 'Новый клиент'}
        size="lg"
      >
        <div className="max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Input
              label="Фамилия"
              value={formData.lastName}
              onChange={(e) => setFormData({ ...formData, lastName: e.target.value })}
            />
            <Input
              label="Имя"
              value={formData.firstName}
              onChange={(e) => setFormData({ ...formData, firstName: e.target.value })}
              required
            />
            <Input
              label="Отчество"
              value={formData.middleName}
              onChange={(e) => setFormData({ ...formData, middleName: e.target.value })}
            />
            <div>
              <Input
                label="Телефон"
                type="tel"
                value={formData.phone}
                onChange={handlePhoneChange}
                required
                icon={Phone}
                placeholder="+7 (___) ___-__-__"
                className={phoneError ? 'border-red-500' : ''}
              />
              {phoneError && (
                <p className="text-sm text-red-500 mt-1">{phoneError}</p>
              )}
            </div>
            <Input
              label="Email"
              type="email"
              value={formData.email}
              onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              icon={Mail}
            />
            <Input
              label="Дата рождения"
              type="date"
              value={formData.birthDate}
              onChange={(e) => setFormData({ ...formData, birthDate: e.target.value })}
              icon={Calendar}
            />
            <div className="md:col-span-2">
              <Input
                label="Город"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                icon={MapPin}
                placeholder="Например: Москва, Санкт-Петербург"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <h3 className="font-medium mb-2">Автомобиль</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Input
                label="Модель"
                value={formData.carModel}
                onChange={(e) => setFormData({ ...formData, carModel: e.target.value })}
                icon={Car}
                placeholder="Например: BMW X5, Toyota Camry"
              />
              <div>
                <Input
                  label="Год выпуска"
                  type="number"
                  value={formData.carYear}
                  onChange={handleCarYearChange}
                  placeholder="1970-2100"
                  min="1970"
                  max="2100"
                  step="1"
                />
                {carYearError && (
                  <p className="text-sm text-red-500 mt-1">{carYearError}</p>
                )}
                <p className="text-xs text-gray-400 mt-1">Допустимые годы: 1970-2100</p>
              </div>
              <Input
                label="Госномер"
                value={formData.carNumber}
                onChange={(e) => setFormData({ ...formData, carNumber: e.target.value })}
                placeholder="А123ВС77"
              />
            </div>
          </div>
          
          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-700 mb-1">Примечания</label>
            <textarea
              className="w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              rows={3}
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="Дополнительная информация о клиенте..."
            />
          </div>
        </div>
        
        <div className="flex justify-end gap-3 mt-4 pt-4 border-t">
          <Button variant="secondary" onClick={() => setShowClientModal(false)}>Отмена</Button>
          <Button onClick={handleSaveClient}>Сохранить</Button>
        </div>
      </Modal>
    </div>
  );
};

export default Clients;