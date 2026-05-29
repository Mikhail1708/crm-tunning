// frontend/src/pages/AuditLogs.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { auditApi } from '../api/audit';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { formatDate } from '../utils/formatters';
import { 
  Download, 
  Trash2, 
  Filter,
  X,
  RefreshCw,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuth } from '../contexts/AuthContext';

interface LogEntry {
  id: number;
  userId: number;
  userName: string;
  userRole: string;
  action: string;
  details: any;
  ip?: string;
  createdAt: string;
}

export const AuditLogs: React.FC = () => {
  const { user } = useAuth();
  const [logs, setLogs] = useState<LogEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalItems, setTotalItems] = useState<number>(0);
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
      
      // Обработка ответа от бэкенда
      if (response && response.logs && Array.isArray(response.logs)) {
        setLogs(response.logs);
        setTotalItems(response.total || 0);
        setTotalPages(Math.ceil((response.total || 0) / 50));
      } else if (Array.isArray(response)) {
        setLogs(response);
        setTotalItems(response.length);
        setTotalPages(1);
      } else {
        setLogs([]);
        setTotalItems(0);
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
  }, [filterAction, dateRange.from, dateRange.to, currentPage]);

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
        setCurrentPage(1);
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
    if (action.includes('POST') || action.includes('Создание')) return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400';
    if (action.includes('PUT') || action.includes('PATCH') || action.includes('Обновление')) return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400';
    if (action.includes('DELETE') || action.includes('Удаление')) return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400';
    return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400';
  };

  const formatAction = (action: string): string => {
    // Убираем лишние символы и форматируем
    const cleanAction = action.replace(/^["']|["']$/g, '');
    if (cleanAction.length > 50) {
      return cleanAction.substring(0, 47) + '...';
    }
    return cleanAction;
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Журнал действий</h1>
        <div className="flex flex-wrap gap-2">
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
            className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600 transition-colors"
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
                  placeholder="POST, PUT, DELETE, Создание..."
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
                  className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:ring-2 focus:ring-primary-500 focus:border-transparent"
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
          <div className="overflow-x-auto">
            <Table>
              <Thead>
                <Tr>
                  <Th className="w-44">Дата и время</Th>
                  <Th className="w-40">Пользователь</Th>
                  <Th className="w-48">Действие</Th>
                  <Th>Детали</Th>
                </Tr>
              </Thead>
              <Tbody>
                {logs.length === 0 ? (
                  <Tr>
                    <Td colSpan={4} className="text-center py-8 text-gray-500">
                      {filterAction || dateRange.from || dateRange.to 
                        ? 'По вашему запросу ничего не найдено' 
                        : 'Логи не найдены'}
                    </Td>
                  </Tr>
                ) : (
                  logs.map((log) => (
                    <Tr key={log.id} className="hover:bg-gray-50 dark:hover:bg-gray-800/50">
                      <Td className="whitespace-nowrap text-sm">
                        {formatDate(log.createdAt)}
                      </Td>
                      <Td>
                        <div>
                          <p className="font-medium text-gray-900 dark:text-white">
                            {log.userName || `Пользователь ${log.userId}`}
                          </p>
                          <p className="text-xs text-gray-500">
                            {log.userRole === 'admin' ? 'Администратор' : 'Менеджер'}
                          </p>
                        </div>
                      </Td>
                      <Td>
                        <span className={`inline-block px-2 py-1 rounded-full text-xs font-medium ${getActionBadgeColor(log.action)}`}>
                          {formatAction(log.action)}
                        </span>
                      </Td>
                      <Td className="max-w-md">
                        <details className="text-xs">
                          <summary className="cursor-pointer text-primary-600 hover:text-primary-700 inline-block">
                            Подробнее
                          </summary>
                          <pre className="mt-2 p-2 bg-gray-100 dark:bg-gray-800 rounded overflow-x-auto text-xs">
                            {JSON.stringify(log.details, null, 2)}
                          </pre>
                        </details>
                        {log.ip && (
                          <p className="text-xs text-gray-400 mt-1">IP: {log.ip}</p>
                        )}
                      </Td>
                    </Tr>
                  ))
                )}
              </Tbody>
            </Table>
          </div>
        </CardBody>
      </Card>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div className="text-sm text-gray-500">
            Всего записей: {totalItems}
          </div>
          <div className="flex items-center gap-2">
            <Button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1}
              variant="secondary"
              size="sm"
              icon={ChevronLeft}
            >
              Назад
            </Button>
            <div className="flex gap-1">
              {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                let pageNum;
                if (totalPages <= 5) {
                  pageNum = i + 1;
                } else if (currentPage <= 3) {
                  pageNum = i + 1;
                } else if (currentPage >= totalPages - 2) {
                  pageNum = totalPages - 4 + i;
                } else {
                  pageNum = currentPage - 2 + i;
                }
                
                return (
                  <button
                    key={pageNum}
                    onClick={() => setCurrentPage(pageNum)}
                    className={`w-8 h-8 rounded-lg text-sm font-medium transition-colors ${
                      currentPage === pageNum
                        ? 'bg-primary-600 text-white'
                        : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                    }`}
                  >
                    {pageNum}
                  </button>
                );
              })}
            </div>
            <Button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages}
              variant="secondary"
              size="sm"
              icon={ChevronRight}
              iconPosition="right"
            >
              Вперед
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditLogs;