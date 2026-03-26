// frontend/src/components/ui/CostBreakdownEditor.jsx
import React, { useState, useEffect } from 'react';
import { Button } from './Button';
import { Input } from './Input';
import { X, Plus, Trash2, Edit, Calculator, DollarSign } from 'lucide-react';
import toast from 'react-hot-toast';

export const CostBreakdownEditor = ({ value = [], onChange, disabled = false }) => {
  const [items, setItems] = useState(value || []);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingIndex, setEditingIndex] = useState(null);
  const [formData, setFormData] = useState({ name: '', amount: '' });

  // Синхронизация с внешним value
  useEffect(() => {
    if (value && JSON.stringify(value) !== JSON.stringify(items)) {
      setItems(value);
    }
  }, [value]);

  const updateItems = (newItems) => {
    setItems(newItems);
    onChange(newItems);
  };

  const totalCost = items.reduce((sum, item) => sum + (parseFloat(item.amount) || 0), 0);

  const handleAddItem = () => {
    if (!formData.name.trim()) {
      toast.error('Введите название затраты');
      return;
    }
    if (!formData.amount || parseFloat(formData.amount) <= 0) {
      toast.error('Введите корректную сумму');
      return;
    }

    const newItem = {
      id: Date.now(),
      name: formData.name.trim(),
      amount: parseFloat(formData.amount)
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

  const handleEditItem = (index, e) => {
    e.stopPropagation();
    setEditingIndex(index);
    setFormData({
      name: items[index].name,
      amount: items[index].amount.toString()
    });
    setModalOpen(true);
  };

  const handleDeleteItem = (index, e) => {
    e.stopPropagation();
    if (confirm('Удалить этот пункт затрат?')) {
      const newItems = items.filter((_, i) => i !== index);
      updateItems(newItems);
      toast.success('Пункт затрат удален');
    }
  };

  const handleOpenModal = (e) => {
    e.stopPropagation();
    setEditingIndex(null);
    setFormData({ name: '', amount: '' });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setEditingIndex(null);
    setFormData({ name: '', amount: '' });
  };

  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  return (
    <>
      <div className="space-y-4" onClick={stopPropagation}>
        {/* Заголовок с итогом */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Calculator size={20} className="text-primary-600" />
            <h3 className="font-medium text-gray-900">Калькуляция себестоимости</h3>
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
                className="flex items-center justify-between p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors group"
                onClick={stopPropagation}
              >
                <div className="flex-1">
                  <p className="font-medium text-gray-900">{item.name}</p>
                  <p className="text-sm text-gray-500">
                    {new Intl.NumberFormat('ru-RU').format(item.amount)} ₽
                  </p>
                </div>
                {!disabled && (
                  <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => handleEditItem(index, e)}
                      className="p-1 text-blue-600 hover:bg-blue-100 rounded transition-colors"
                      title="Редактировать"
                      type="button"
                    >
                      <Edit size={16} />
                    </button>
                    <button
                      onClick={(e) => handleDeleteItem(index, e)}
                      className="p-1 text-red-600 hover:bg-red-100 rounded transition-colors"
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
            <div className="pt-3 mt-2 border-t border-gray-200">
              <div className="flex items-center justify-between p-3 bg-primary-50 rounded-lg">
                <div className="flex items-center gap-2">
                  <DollarSign size={20} className="text-primary-600" />
                  <span className="font-semibold text-gray-900">Общая себестоимость:</span>
                </div>
                <span className="text-xl font-bold text-primary-700">
                  {new Intl.NumberFormat('ru-RU').format(totalCost)} ₽
                </span>
              </div>
            </div>
          </div>
        ) : (
          <div className="text-center py-8 bg-gray-50 rounded-lg">
            <Calculator size={32} className="mx-auto text-gray-400 mb-2" />
            <p className="text-gray-500 text-sm">Нет добавленных затрат</p>
            {!disabled && (
              <p className="text-gray-400 text-xs mt-1">
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
            className="bg-white rounded-2xl shadow-xl max-w-md w-full animate-scale-up"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h2 className="text-xl font-semibold text-gray-900">
                {editingIndex !== null ? 'Редактировать затрату' : 'Добавить затрату'}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
                type="button"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="space-y-4">
                <Input
                  label="Название затраты"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Например: Резка металла"
                  autoFocus
                />
                <Input
                  label="Сумма (₽)"
                  type="number"
                  value={formData.amount}
                  onChange={(e) => setFormData({ ...formData, amount: e.target.value })}
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

export default CostBreakdownEditor; // Добавляем default export