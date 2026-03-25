// frontend/src/pages/Sales.jsx
import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Input } from '../components/ui/Input';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { formatPrice, formatDate } from '../utils/formatters';
import { 
  ShoppingCart, 
  TrendingUp, 
  Receipt, 
  Trash2,
  Search,
  Loader,
  Plus
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Sales = () => {
  const navigate = useNavigate();
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  useEffect(() => {
    loadDocuments();
  }, []);

  const loadDocuments = async () => {
    try {
      setLoading(true);
      const { data } = await saleDocumentsApi.getAll();
      console.log('Loaded documents:', data);
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
      toast.error('Ошибка загрузки заказов');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id, e) => {
    e.stopPropagation(); // Останавливаем всплытие, чтобы не открывать заказ
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

  const handleRowClick = (id) => {
    console.log('Navigating to order:', id);
    navigate(`/sales/${id}`);
  };

  const filterDocuments = (doc) => {
    if (!searchTerm.trim()) return true;
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (doc.documentNumber?.toLowerCase().includes(searchLower)) return true;
    if (doc.customerName?.toLowerCase().includes(searchLower)) return true;
    if (doc.customerPhone?.toLowerCase().includes(searchLower)) return true;
    
    if (doc.items?.some(item => 
      item.productName?.toLowerCase().includes(searchLower) ||
      item.productArticle?.toLowerCase().includes(searchLower)
    )) return true;
    
    if (doc.total?.toString().includes(searchLower)) return true;
    
    return false;
  };

  const filteredDocuments = documents.filter(filterDocuments);

  const stats = {
    total: documents.length,
    totalRevenue: documents.reduce((sum, d) => sum + (d.total || 0), 0),
    totalProfit: documents.reduce((sum, d) => sum + (d.total || 0), 0),
    averageCheck: documents.length > 0 ? documents.reduce((sum, d) => sum + (d.total || 0), 0) / documents.length : 0,
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
          <h1 className="text-3xl font-bold text-gray-900">Заказы</h1>
          <p className="text-gray-500 mt-1">Управление заказами и документами</p>
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
                <p className="text-sm text-gray-500">Всего заказов</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <ShoppingCart size={32} className="text-primary-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Общая выручка</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalRevenue)}</p>
              </div>
              <TrendingUp size={32} className="text-green-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Общая прибыль</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalProfit)}</p>
              </div>
              <Receipt size={32} className="text-blue-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Средний чек</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.averageCheck)}</p>
              </div>
              <Receipt size={32} className="text-purple-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
      </div>

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

      {/* Orders Table */}
      <Card>
        <CardBody className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>№ заказа</Th>
                <Th>Дата</Th>
                <Th>Покупатель</Th>
                <Th>Телефон</Th>
                <Th>Товаров</Th>
                <Th>Сумма</Th>
                <Th>Статус</Th>
                <Th>Действия</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredDocuments.map((doc) => (
                <Tr 
                  key={doc.id} 
                  className="hover:bg-gray-50 transition-colors group"
                  onClick={() => handleRowClick(doc.id)}
                  style={{ cursor: 'pointer' }}
                >
                  <Td className="font-mono text-sm font-medium text-primary-600">{doc.documentNumber}</Td>
                  <Td>{formatDate(doc.saleDate)}</Td>
                  <Td>{doc.customerName || '—'}</Td>
                  <Td>{doc.customerPhone || '—'}</Td>
                  <Td>{doc.items?.length || 0} шт.</Td>
                  <Td className="font-semibold">{formatPrice(doc.total)}</Td>
                  <Td>
                    <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                      doc.paymentStatus === 'paid' 
                        ? 'bg-green-100 text-green-700' 
                        : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {doc.paymentStatus === 'paid' ? 'Оплачен' : 'Не оплачен'}
                    </span>
                  </Td>
                  <Td onClick={(e) => e.stopPropagation()}>
                    <button
                      onClick={(e) => handleDelete(doc.id, e)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить заказ"
                    >
                      <Trash2 size={18} />
                    </button>
                  </Td>
                </Tr>
              ))}
            </Tbody>
          </Table>
          {filteredDocuments.length === 0 && (
            <div className="text-center py-12 text-gray-500">
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