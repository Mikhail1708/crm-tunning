// frontend/src/components/ui/CostBreakdownEditor.tsx
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { X, Plus, Trash2, Edit, Calculator, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

// Типы
interface CostItem {
  id?: number;
  name: string;
  amount: number;
}

interface CostBreakdownEditorProps {
  value?: CostItem[];
  onChange: (items: CostItem[]) => void;
  disabled?: boolean;
}

interface FormData {
  name: string;
  amount: string;
}

export const CostBreakdownEditor: React.FC<CostBreakdownEditorProps> = ({ 
  value = [], 
  onChange, 
  disabled = false 
}) => {
  const [items, setItems] = useState<CostItem[]>(value || []);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>({ name: '', amount: '' });

  // Синхронизация с внешним value
  useEffect(() => {
    if (value && JSON.stringify(value) !== JSON.stringify(items)) {
      setItems(value);
    }
  }, [value]);

  const updateItems = (newItems: CostItem[]): void => {
    setItems(newItems);
    onChange(newItems);
  };

  const totalCost: number = items.reduce((sum, item) => sum + (item.amount || 0), 0);

  const handleAddItem = (): void => {
    if (!formData.name.trim()) {
      toast.error('Введите название затраты');
      return;
    }
    const amountNum = parseFloat(formData.amount);
    if (isNaN(amountNum) || amountNum <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    const newItem: CostItem = {
      id: Date.now(),
      name: formData.name.trim(),
      amount: amountNum
    };

    if (editingIndex !== null) {
      const newItems = [...items];
      newItems[editingIndex] = newItem;
      updateItems(newItems);
      toast.success('Пункт затрат обновлен');
    } else {
      updateItems([...items, newItem]);
      toast.success('Пункт затрат добавлен');
    }

    closeModal();
  };

  const handleEditItem = (index: number, e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditingIndex(index);
    setFormData({
      name: items[index].name,
      amount: items[index].amount.toString()
    });
    setModalOpen(true);
  };

  const handleDeleteItem = (index: number, e: React.MouseEvent): void => {
    e.stopPropagation();
    if (window.confirm('Удалить этот пункт затрат?')) {
      const newItems = items.filter((_, i) => i !== index);
      updateItems(newItems);
      toast.success('Пункт затрат удален');
    }
  };

  const handleOpenModal = (e: React.MouseEvent): void => {
    e.stopPropagation();
    setEditingIndex(null);
    setFormData({ name: '', amount: '' });
    setModalOpen(true);
  };

  const closeModal = (): void => {
    setModalOpen(false);
    setEditingIndex(null);
    setFormData({ name: '', amount: '' });
  };

  const stopPropagation = (e: React.MouseEvent): void => {
    e.stopPropagation();
  };

  return (
    <>
      <div className="space-y-4" onClick={stopPropagation}>
        {/* Заголовок с итогом */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-primary-600" />
            <h3 className="font-medium text-gray-900 dark:text-white">Калькуляция себестоимости</h3>
          </div>
          {!disabled && (
            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              onClick={handleOpenModal}
              type="button"
            >
              Добавить затрату
            </Button>
          )}
        </div>

        {/* Список пунктов затрат */}
        {items.length > 0 ? (
          <div className="space-y-2">
            {items.map((item, index) => (
              <div
                key={item.id || index}
                className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors group"
                onClick={stopPropagation}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white">{item.name}</p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    {new Intl.NumberFormat('ru-RU').format(item.amount)} ₽
                  </p>
                </div>
                {!disabled && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEditItem(index, e)}
                      className="p-1 text-blue-600 hover:bg-blue-100 dark:hover:bg-blue-900/30 rounded transition-colors"
                      title="Редактировать"
                      type="button"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteItem(index, e)}
                      className="p-1 text-red-600 hover:bg-red-100 dark:hover:bg-red-900/30 rounded transition-colors"
                      title="Удалить"
                      type="button"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                )}
              </div>
            ))}

            {/* Итоговая себестоимость */}
            <div className="pt-3 mt-2 border-t border-gray-200 dark:border-gray-700">
              <div className="flex items-center justify-between p-3 bg-primary-50 dark:bg-primary-900/20 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign size={20} className="text-primary-600 dark:text-primary-400" />
                  <span className="font-semibold text-gray-900 dark:text-white">Общая себестоимость:</span>
                </div>
                <span className="text-xl font-bold text-primary-700 dark:text-primary-400">
                  {new Intl.NumberFormat('ru-RU').format(totalCost)} ₽
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <Calculator size={32} className="mx-auto text-gray-400 dark:text-gray-600 mb-2" />
            <p className="text-gray-500 dark:text-gray-400 text-sm">Нет добавленных затрат</p>
            {!disabled && (
              <p className="text-gray-400 dark:text-gray-500 text-xs mt-1">
                Нажмите "Добавить затрату", чтобы указать из чего состоит себестоимость
              </p>
            )}
          </div>
        )}
      </div>

      {/* Модальное окно для добавления/редактирования */}
      {modalOpen && (
        <div 
          className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-black/50"
          onClick={closeModal}
        >
          <div 
            className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl max-w-md w-full animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100 dark:border-gray-700">
              <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                {editingIndex !== null ? 'Редактировать затрату' : 'Добавить затрату'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
                type="button"
              >
                <X size={20} className="text-gray-500 dark:text-gray-400" />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <Input
                  label="Название затраты"
                  value={formData.name}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setFormData({ ...formData, name: e.target.value })
                  }
                  placeholder="Например: Резка металла"
                  autoFocus
                />
                <Input
                  label="Сумма (₽)"
                  type="number"
                  value={formData.amount}
                  onChange={(e: React.ChangeEvent<HTMLInputElement>) => 
                    setFormData({ ...formData, amount: e.target.value })
                  }
                  placeholder="0"
                  step="0.01"
                  min="0"
                />
                <div className="flex gap-3 pt-4">
                  <Button onClick={handleAddItem} fullWidth type="button">
                    {editingIndex !== null ? 'Сохранить' : 'Добавить'}
                  </Button>
                  <Button variant="secondary" onClick={closeModal} fullWidth type="button">
                    Отмена
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default CostBreakdownEditor;