// frontend/src/pages/Settings.jsx (добавить в раздел управления данными)

import React, { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useTheme } from '../contexts/ThemeContext';
import { reportsApi } from '../api/reports';
import { Button } from '../components/ui/Button';
import { Card, CardBody, CardHeader } from '../components/ui/Card';
import { 
  Sun, 
  Moon, 
  Download, 
  Upload,  // Добавляем иконку загрузки
  Trash2, 
  AlertCircle,
  Database,
  Shield,
  Loader
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Settings = () => {
  const { user } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const [loadingDump, setLoadingDump] = useState(false);
  const [loadingRestore, setLoadingRestore] = useState(false);
  const [loadingClear, setLoadingClear] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const fileInputRef = useRef(null);
  
  const isAdmin = user?.role === 'admin';

  // Экспорт дампа базы данных
  const exportDatabaseDump = async () => {
    if (!isAdmin) {
      toast.error('Доступ запрещен. Требуются права администратора');
      return;
    }

    setLoadingDump(true);
    try {
      const response = await reportsApi.getDatabaseDump();
      const dump = response.data;
      
      // Создаем файл для скачивания
      const dataStr = JSON.stringify(dump, null, 2);
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `database_dump_${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.json`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      toast.success('Дамп базы данных успешно экспортирован');
    } catch (error) {
      console.error('Error exporting database dump:', error);
      toast.error(error.response?.data?.message || 'Ошибка экспорта дампа');
    } finally {
      setLoadingDump(false);
    }
  };

  // Импорт дампа базы данных (восстановление)
  const importDatabaseDump = async (event) => {
    if (!isAdmin) {
      toast.error('Доступ запрещен. Требуются права администратора');
      return;
    }

    const file = event.target.files[0];
    if (!file) return;

    if (!file.name.endsWith('.json')) {
      toast.error('Пожалуйста, выберите JSON файл дампа');
      return;
    }

    setLoadingRestore(true);
    try {
      const text = await file.text();
      const dumpData = JSON.parse(text);
      
      // Проверяем структуру дампа
      if (!dumpData.exportedAt || !dumpData.data) {
        throw new Error('Неверный формат файла дампа');
      }
      
      // Подтверждение восстановления
      if (confirm(`Восстановить базу данных из дампа от ${new Date(dumpData.exportedAt).toLocaleString()}?\n\nВНИМАНИЕ! Текущие данные будут полностью заменены. Это действие нельзя отменить.`)) {
        await reportsApi.restoreDatabase(dumpData);
        toast.success('База данных успешно восстановлена');
        // Перезагружаем страницу через 2 секунды
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      }
    } catch (error) {
      console.error('Error restoring database:', error);
      toast.error(error.message || 'Ошибка восстановления базы данных');
    } finally {
      setLoadingRestore(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // Очистка всей базы данных
  const clearDatabase = async () => {
    if (!isAdmin) {
      toast.error('Доступ запрещен. Требуются права администратора');
      return;
    }

    setLoadingClear(true);
    try {
      await reportsApi.clearDatabase();
      toast.success('База данных успешно очищена');
      setShowClearConfirm(false);
      
      setTimeout(() => {
        window.location.reload();
      }, 2000);
    } catch (error) {
      console.error('Error clearing database:', error);
      toast.error(error.response?.data?.message || 'Ошибка очистки базы данных');
    } finally {
      setLoadingClear(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Настройки</h1>
        <p className="text-gray-500 dark:text-gray-400 mt-1">Управление системой и внешним видом</p>
      </div>

      {/* Внешний вид */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Sun size={20} className="text-yellow-500" />
            Внешний вид
          </h2>
        </CardHeader>
        <CardBody>
          <div className="flex items-center justify-between">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Тема оформления</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                {theme === 'light' ? 'Светлая тема' : 'Темная тема'}
              </p>
            </div>
            <Button
              onClick={toggleTheme}
              variant="secondary"
              icon={theme === 'light' ? Moon : Sun}
            >
              {theme === 'light' ? 'Темная тема' : 'Светлая тема'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Управление данными */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Database size={20} className="text-blue-500" />
            Управление данными
          </h2>
        </CardHeader>
        <CardBody className="space-y-6">
          {/* Экспорт дампа */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Экспорт базы данных</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Создать резервную копию всех данных в формате JSON
              </p>
            </div>
            <Button
              onClick={exportDatabaseDump}
              disabled={!isAdmin || loadingDump}
              variant="primary"
              icon={Download}
            >
              {loadingDump ? <Loader className="animate-spin" size={16} /> : 'Экспорт'}
            </Button>
          </div>

          {/* Импорт дампа (восстановление) */}
          <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <div>
              <p className="font-medium text-gray-900 dark:text-white">Восстановление из дампа</p>
              <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
                Восстановить базу данных из ранее созданной резервной копии
              </p>
              <p className="text-xs text-yellow-600 dark:text-yellow-400 mt-1">
                ⚠️ Внимание! Текущие данные будут полностью заменены
              </p>
            </div>
            <div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".json"
                onChange={importDatabaseDump}
                className="hidden"
                id="restore-file"
              />
              <Button
                onClick={() => document.getElementById('restore-file').click()}
                disabled={!isAdmin || loadingRestore}
                variant="secondary"
                icon={Upload}
              >
                {loadingRestore ? <Loader className="animate-spin" size={16} /> : 'Восстановить'}
              </Button>
            </div>
          </div>

          {/* Очистка базы */}
          <div className="flex items-center justify-between p-4 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
            <div>
              <div className="flex items-center gap-2">
                <AlertCircle size={18} className="text-red-500" />
                <p className="font-medium text-red-700 dark:text-red-400">Очистка базы данных</p>
              </div>
              <p className="text-sm text-red-600 dark:text-red-300 mt-1">
                Внимание! Это действие удалит ВСЕ данные: товары, клиентов, продажи, категории.
                Действие необратимо.
              </p>
            </div>
            <Button
              onClick={() => setShowClearConfirm(true)}
              disabled={!isAdmin || loadingClear}
              variant="danger"
              icon={Trash2}
            >
              {loadingClear ? <Loader className="animate-spin" size={16} /> : 'Очистить все'}
            </Button>
          </div>
        </CardBody>
      </Card>

      {/* Информация о системе */}
      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold text-gray-900 dark:text-white flex items-center gap-2">
            <Shield size={20} className="text-green-500" />
            Информация о системе
          </h2>
        </CardHeader>
        <CardBody>
          <div className="space-y-3">
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Версия CRM</span>
              <span className="font-medium text-gray-900 dark:text-white">v1.0.0</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Пользователь</span>
              <span className="font-medium text-gray-900 dark:text-white">{user?.name || '-'}</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-100 dark:border-gray-700">
              <span className="text-gray-600 dark:text-gray-400">Роль</span>
              <span className={`font-medium ${isAdmin ? 'text-green-600' : 'text-blue-600'}`}>
                {isAdmin ? 'Администратор' : 'Менеджер'}
              </span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-gray-600 dark:text-gray-400">Email</span>
              <span className="font-medium text-gray-900 dark:text-white">{user?.email || '-'}</span>
            </div>
          </div>
        </CardBody>
      </Card>

      {/* Модалка подтверждения очистки */}
      {showClearConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
          <div className="bg-white dark:bg-gray-800 rounded-xl shadow-xl max-w-md w-full">
            <div className="p-6 border-b border-gray-200 dark:border-gray-700">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-red-100 dark:bg-red-900/30 flex items-center justify-center">
                  <AlertCircle size={20} className="text-red-600 dark:text-red-400" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                  Очистка базы данных
                </h3>
              </div>
            </div>
            <div className="p-6">
              <p className="text-gray-600 dark:text-gray-300">
                Вы уверены, что хотите полностью очистить базу данных?
              </p>
              <p className="text-sm text-red-600 dark:text-red-400 mt-2">
                ⚠️ Это действие нельзя отменить. Все данные будут безвозвратно удалены.
              </p>
              <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg">
                <p className="text-sm text-yellow-800 dark:text-yellow-300">
                  Будут удалены:
                </p>
                <ul className="text-xs text-yellow-700 dark:text-yellow-400 mt-1 list-disc list-inside">
                  <li>Все товары и категории</li>
                  <li>Все клиенты</li>
                  <li>Все продажи и заказы</li>
                  <li>Все расходы</li>
                  <li>Все характеристики товаров</li>
                </ul>
              </div>
            </div>
            <div className="flex gap-3 p-6 pt-0">
              <Button
                variant="danger"
                onClick={clearDatabase}
                disabled={loadingClear}
                fullWidth
              >
                {loadingClear ? <Loader className="animate-spin" size={16} /> : 'Да, очистить все'}
              </Button>
              <Button
                variant="secondary"
                onClick={() => setShowClearConfirm(false)}
                fullWidth
              >
                Отмена
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};