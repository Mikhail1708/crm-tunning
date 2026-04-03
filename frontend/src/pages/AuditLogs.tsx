// frontend/src/pages/AuditLogs.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { auditApi, AuditLog } from '../api/audit';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { formatDate } from '../utils/formatters';
import { 
  Search, 
  Download, 
  Trash2, 
  Calendar,
  Filter,
  X,
  RefreshCw
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

export const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [filterAction, setFilterAction] = useState<string>('');
  const [dateRange, setDateRange] = useState<{ from: string; to: string }>({
    from: '',
    to: ''
  });
  const [showFilters, setShowFilters] = useState<boolean>(false);

  const isAdmin = user?.role === 'admin';
const loadLogs = useCallback(async () => {
  try {
    setLoading(true);
    const response = await auditApi.getLogs({
      action: filterAction || undefined,
      fromDate: dateRange.from || undefined,
      toDate: dateRange.to || undefined,
      page: currentPage,
      limit: 50
    });
    
    // Исправленная обработка ответа
    if (response && response.logs !== undefined) {
      // Бэкенд вернул { logs: [], total: number }
      setLogs(response.logs);
      setTotalPages(Math.ceil(response.total / 50));
    } else if (response && response.data) {
      // Альтернативный формат
      setLogs(response.data);
      setTotalPages(response.pagination?.pages || 1);
    } else if (Array.isArray(response)) {
      // Просто массив
      setLogs(response);
      setTotalPages(1);
    } else {
      setLogs([]);
      setTotalPages(1);
    }
  } catch (error) {
    console.error('Error loading logs:', error);
    toast.error('Ошибка загрузки логов');
    setLogs([]);
    setTotalPages(1);
  } finally {
    setLoading(false);
  }
}, [filterAction, dateRange, currentPage]);

  useEffect(() => {
    loadLogs();
  }, [loadLogs]);

  const handleExport = async () => {
    try {
      toast.loading('Экспорт логов...', { id: 'export' });
      const blob = await auditApi.exportLogs({
        action: filterAction || undefined,
        fromDate: dateRange.from || undefined,
        toDate: dateRange.to || undefined
      });
      
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit_logs_${new Date().toISOString().split('T')[0]}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success('Экспорт завершен', { id: 'export' });
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast.error('Ошибка экспорта', { id: 'export' });
    }
  };

  const handleClean = async () => {
    if (!isAdmin) {
      toast.error('Доступ запрещен');
      return;
    }
    
    if (window.confirm('Очистить старые логи? (будут удалены логи старше 5000 записей)')) {
      try {
        await auditApi.cleanLogs(5000);
        toast.success('Логи очищены');
        loadLogs();
      } catch (error) {
        console.error('Error cleaning logs:', error);
        toast.error('Ошибка очистки логов');
      }
    }
  };

  const resetFilters = () => {
    setFilterAction('');
    setDateRange({ from: '', to: '' });
    setCurrentPage(1);
  };

  const getActionBadgeColor = (action: string): string => {
    if (action.includes('POST')) return 'bg-green-100 text-green-700';
    if (action.includes('PUT') || action.includes('PATCH')) return 'bg-blue-100 text-blue-700';
    if (action.includes('DELETE')) return 'bg-red-100 text-red-700';
    return 'bg-gray-100 text-gray-700';
  };

  if (loading && currentPage === 1) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="w-8 h-8 border-4 border-primary-600 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Журнал действий</h1>
        <div className="flex gap-2">
          <Button onClick={loadLogs} variant="secondary" icon={RefreshCw} size="sm">
            Обновить
          </Button>
          <Button onClick={handleExport} variant="secondary" icon={Download} size="sm">
            Экспорт CSV
          </Button>
          {isAdmin && (
            <Button onClick={handleClean} variant="danger" icon={Trash2} size="sm">
              Очистить
            </Button>
          )}
        </div>
      </div>

      {/* Filters */}
      <Card>
        <CardBody>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600"
          >
            <Filter size={14} />
            {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
          </button>
          
          {showFilters && (
            <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Действие
                </label>
                <input
                  type="text"
                  value={filterAction}
                  onChange={(e) => setFilterAction(e.target.value)}
                  placeholder="POST, PUT, DELETE..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  С даты
                </label>
                <input
                  type="date"
                  value={dateRange.from}
                  onChange={(e) => setDateRange({ ...dateRange, from: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  По дату
                </label>
                <input
                  type="date"
                  value={dateRange.to}
                  onChange={(e) => setDateRange({ ...dateRange, to: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white"
                />
              </div>
            </div>
          )}
          
          {(filterAction || dateRange.from || dateRange.to) && (
            <div className="mt-3 flex justify-end">
              <Button onClick={resetFilters} variant="ghost" size="sm" icon={X}>
                Сбросить фильтры
              </Button>
            </div>
          )}
        </CardBody>
      </Card>

      {/* Logs Table */}
      <Card>
        <CardBody className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th>Дата и время</Th>
                <Th>Пользователь</Th>
                <Th>Действие</Th>
                <Th>Детали</Th>
              </Tr>
            </Thead>
            <Tbody>
              {logs.length === 0 ? (
                <Tr>
                  <Td colSpan={4} className="text-center py-8 text-gray-500">
                    Логи не найдены
                  </Td>
                </Tr>
              ) : (
                logs.map((log) => (
                  <Tr key={log.id}>
                    <Td className="whitespace-nowrap">{formatDate(log.createdAt)}</Td>
                    <Td>
                      <div>
                        <p className="font-medium text-gray-900 dark:text-white">{log.userEmail}</p>
                        <p className="text-xs text-gray-500">
                          {log.userRole === 'admin' ? 'Администратор' : 'Менеджер'}
                        </p>
                      </div>
                    </Td>
                    <Td>
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                        {log.action}
                      </span>
                    </Td>
                    <Td>
                      <details className="text-xs">
                        <summary className="cursor-pointer text-primary-600">Подробнее</summary>
                        <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    </Td>
                  </Tr>
                ))
              )}
            </Tbody>
          </Table>
        </CardBody>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex justify-center gap-2">
          <Button
            onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
            disabled={currentPage === 1}
            variant="secondary"
            size="sm"
          >
            Назад
          </Button>
          <span className="px-4 py-2 text-sm text-gray-600 dark:text-gray-400">
            Страница {currentPage} из {totalPages}
          </span>
          <Button
            onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
            disabled={currentPage === totalPages}
            variant="secondary"
            size="sm"
          >
            Вперед
          </Button>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;