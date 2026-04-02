// frontend/src/pages/AuditLogs.tsx
import React, { useState, useEffect } from 'react';
import { auditApi } from '../api/audit';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { AuditLog, PaginatedResponse } from '../types';
import { 
  Activity, 
  Search, 
  Download, 
  Trash2, 
  RefreshCw,
  Filter,
  Calendar,
  User,
  FileText,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface AuditStats {
  total: number;
  byAction: Record<string, number>;
  byUser: Record<string, number>;
  byDate: Record<string, number>;
}

interface LogFilters {
  action: string;
  fromDate: string;
  toDate: string;
  page: number;
  limit: number;
}

export const AuditLogs: React.FC = () => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [stats, setStats] = useState<AuditStats | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [filters, setFilters] = useState<LogFilters>({
    action: '',
    fromDate: '',
    toDate: '',
    page: 1,
    limit: 50
  });
  const [total, setTotal] = useState<number>(0);

  useEffect(() => {
    loadLogs();
    loadStats();
  }, [filters]);

  const loadLogs = async (): Promise<void> => {
    try {
      setLoading(true);
      const { data } = await auditApi.getLogs(filters);
      setLogs(data.data.logs);
      setTotal(data.data.total);
    } catch (error) {
      console.error('Error loading logs:', error);
      toast.error('Ошибка загрузки логов');
    } finally {
      setLoading(false);
    }
  };

  const loadStats = async (): Promise<void> => {
    try {
      const { data } = await auditApi.getStats();
      setStats(data);
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  };

  const handleExport = async (): Promise<void> => {
    try {
      const response = await auditApi.exportLogs(filters);
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `audit_logs_${new Date().toISOString().split('T')[0]}.csv`);
      document.body.appendChild(link);
      link.click();
      link.remove();
      toast.success('Экспорт выполнен');
    } catch (error) {
      console.error('Error exporting logs:', error);
      toast.error('Ошибка экспорта');
    }
  };

  const handleClean = async (): Promise<void> => {
    if (confirm('Очистить старые логи (оставить последние 5000)? Это действие необратимо.')) {
      try {
        await auditApi.cleanLogs(5000);
        toast.success('Логи очищены');
        loadLogs();
        loadStats();
      } catch (error) {
        console.error('Error cleaning logs:', error);
        toast.error('Ошибка очистки логов');
      }
    }
  };

  const getActionColor = (action: string): string => {
    if (action.includes('Удаление')) return 'text-red-600 bg-red-50';
    if (action.includes('Создание')) return 'text-green-600 bg-green-50';
    if (action.includes('Редактирование')) return 'text-blue-600 bg-blue-50';
    if (action.includes('Вход') || action.includes('Выход')) return 'text-purple-600 bg-purple-50';
    return 'text-gray-600 bg-gray-50';
  };

  const formatDate = (dateString: string): string => {
    return new Date(dateString).toLocaleString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Activity size={28} />
            Журнал действий
          </h1>
          <p className="text-gray-500 mt-1">Все действия пользователей в системе</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={handleExport} icon={Download} variant="secondary">
            Экспорт CSV
          </Button>
          <Button onClick={handleClean} icon={Trash2} variant="danger">
            Очистить старые
          </Button>
          <Button onClick={loadLogs} icon={RefreshCw} variant="secondary">
            Обновить
          </Button>
        </div>
      </div>

      {/* Статистика */}
      {stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-gray-500 text-sm">Всего записей</p>
            <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-gray-500 text-sm">Топ действий</p>
            <p className="text-lg font-semibold text-gray-900">
              {Object.entries(stats.byAction).sort((a, b) => b[1] - a[1])[0]?.[0] || '-'}
            </p>
            <p className="text-sm text-gray-500">
              {Object.entries(stats.byAction).sort((a, b) => b[1] - a[1])[0]?.[1] || 0} раз
            </p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-gray-500 text-sm">Активных пользователей</p>
            <p className="text-2xl font-bold text-gray-900">{Object.keys(stats.byUser).length}</p>
          </div>
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
            <p className="text-gray-500 text-sm">Сегодня</p>
            <p className="text-2xl font-bold text-gray-900">
              {stats.byDate[new Date().toISOString().split('T')[0]] || 0}
            </p>
          </div>
        </div>
      )}

      {/* Фильтры */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4">
        <div className="flex items-center gap-2 mb-4">
          <Filter size={18} className="text-gray-500" />
          <h3 className="font-medium text-gray-900">Фильтры</h3>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Input
            placeholder="Поиск по действию"
            value={filters.action}
            onChange={(e) => setFilters({ ...filters, action: e.target.value, page: 1 })}
            icon={Search}
          />
          <Input
            type="date"
            placeholder="Дата с"
            value={filters.fromDate}
            onChange={(e) => setFilters({ ...filters, fromDate: e.target.value, page: 1 })}
            icon={Calendar}
          />
          <Input
            type="date"
            placeholder="Дата по"
            value={filters.toDate}
            onChange={(e) => setFilters({ ...filters, toDate: e.target.value, page: 1 })}
            icon={Calendar}
          />
        </div>
      </div>

      {/* Таблица логов */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Дата и время
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Пользователь
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Действие
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Детали
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  IP
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                    <p className="mt-2">Загрузка...</p>
                   </td>
                 </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    <AlertCircle size={48} className="mx-auto mb-2 text-gray-300" />
                    <p>Нет записей</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => (
                  <tr key={log.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {formatDate(log.timestamp)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-2">
                        <User size={14} className="text-gray-400" />
                        <span className="text-sm font-medium text-gray-900">{log.user.name}</span>
                        <span className="text-xs text-gray-500">({log.user.email})</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-2 py-1 rounded-full text-xs font-medium ${getActionColor(log.action)}`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <details className="text-sm text-gray-600">
                        <summary className="cursor-pointer text-blue-600 hover:text-blue-700">
                          Подробнее
                        </summary>
                        <pre className="mt-2 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                          {JSON.stringify(log.details, null, 2)}
                        </pre>
                      </details>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {log.ip || '-'}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Пагинация */}
        {total > filters.limit && (
          <div className="px-6 py-4 border-t border-gray-200 flex items-center justify-between">
            <p className="text-sm text-gray-500">
              Показано {logs.length} из {total} записей
            </p>
            <div className="flex gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFilters({ ...filters, page: filters.page - 1 })}
                disabled={filters.page === 1}
              >
                Назад
              </Button>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => setFilters({ ...filters, page: filters.page + 1 })}
                disabled={logs.length < filters.limit}
              >
                Вперед
              </Button>
            </div>
          </div>
        )}
      </div>

      <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
        <div className="flex items-start gap-3">
          <FileText size={20} className="text-blue-600 mt-0.5" />
          <div className="text-sm text-blue-800">
            <p className="font-medium mb-1">О системе логов</p>
            <p>Все действия пользователей сохраняются в отдельный файл и не зависят от базы данных.</p>
            <p>Даже при полной очистке БД история действий останется доступной.</p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default AuditLogs;