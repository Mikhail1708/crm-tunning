// frontend/src/pages/Categories.jsx
import React, { useState, useEffect } from 'react';
import { categoriesApi } from '../api/categories';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Settings,
  Loader,
  Package,
  List,
  X,
  PlusCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

export const Categories = () => {
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [fieldsModalOpen, setFieldsModalOpen] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    icon: '',
    sortOrder: 0
  });
  const [fieldFormData, setFieldFormData] = useState({
    name: '',
    fieldType: 'select', // Изменено на select по умолчанию
    isRequired: false,
    sortOrder: 0,
    options: []
  });
  const [optionsInput, setOptionsInput] = useState('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async () => {
    try {
      setLoading(true);
      const { data } = await categoriesApi.getAll();
      setCategories(data);
    } catch (error) {
      toast.error('Ошибка загрузки категорий');
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      if (selectedCategory) {
        await categoriesApi.update(selectedCategory.id, formData);
        toast.success('Категория обновлена');
      } else {
        await categoriesApi.create(formData);
        toast.success('Категория создана');
      }
      setModalOpen(false);
      loadCategories();
      resetForm();
    } catch (error) {
      toast.error('Ошибка сохранения');
    }
  };

  const handleDelete = async (id, name) => {
    if (confirm(`Удалить категорию "${name}"? Все товары в этой категории потеряют связь.`)) {
      try {
        await categoriesApi.delete(id);
        toast.success('Категория удалена');
        loadCategories();
      } catch (error) {
        toast.error('Ошибка удаления');
      }
    }
  };

  const handleFieldSubmit = async (e) => {
    e.preventDefault();
    
    // Преобразуем строку с опциями в массив
    let optionsArray = [];
    if (optionsInput.trim()) {
      optionsArray = optionsInput.split(',').map(opt => opt.trim()).filter(opt => opt);
    }
    
    const fieldData = {
      ...fieldFormData,
      options: optionsArray
    };
    
    try {
      await categoriesApi.createField(selectedCategory.id, fieldData);
      toast.success('Характеристика добавлена');
      setFieldsModalOpen(false);
      loadCategories();
      resetFieldForm();
    } catch (error) {
      toast.error('Ошибка добавления характеристики');
    }
  };

  const handleDeleteField = async (fieldId) => {
    if (confirm('Удалить характеристику?')) {
      try {
        await categoriesApi.deleteField(fieldId);
        toast.success('Характеристика удалена');
        loadCategories();
      } catch (error) {
        toast.error('Ошибка удаления');
      }
    }
  };

  const resetForm = () => {
    setSelectedCategory(null);
    setFormData({
      name: '',
      description: '',
      icon: '',
      sortOrder: 0
    });
  };

  const resetFieldForm = () => {
    setFieldFormData({
      name: '',
      fieldType: 'select',
      isRequired: false,
      sortOrder: 0,
      options: []
    });
    setOptionsInput('');
  };

  const fieldTypes = [
    { value: 'select', label: 'Выпадающий список' },
    { value: 'multiselect', label: 'Множественный выбор' },
    { value: 'text', label: 'Текст' },
    { value: 'number', label: 'Число' }
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Категории</h1>
          <p className="text-gray-500 mt-1">Управление категориями и их характеристиками</p>
        </div>
        <Button onClick={() => {
          resetForm();
          setModalOpen(true);
        }} icon={Plus} variant="primary">
          Добавить категорию
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {categories.map((category) => (
          <Card key={category.id} className="hover:shadow-lg transition-shadow">
            <CardBody className="p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-primary-100 flex items-center justify-center">
                    <Package size={24} className="text-primary-600" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-gray-900">{category.name}</h3>
                    <p className="text-sm text-gray-500">
                      {category._count?.products || 0} товаров
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      setSelectedCategory(category);
                      setFieldsModalOpen(true);
                    }}
                    className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition-colors"
                    title="Управление характеристиками"
                  >
                    <Settings size={18} />
                  </button>
                  <button
                    onClick={() => {
                      setSelectedCategory(category);
                      setFormData({
                        name: category.name,
                        description: category.description || '',
                        icon: category.icon || '',
                        sortOrder: category.sortOrder
                      });
                      setModalOpen(true);
                    }}
                    className="p-2 text-blue-500 hover:bg-blue-50 rounded-lg transition-colors"
                  >
                    <Edit size={18} />
                  </button>
                  <button
                    onClick={() => handleDelete(category.id, category.name)}
                    className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  >
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
              
              {category.description && (
                <p className="text-gray-600 text-sm mb-4">{category.description}</p>
              )}

              {/* Характеристики категории */}
              {category.fields && category.fields.length > 0 && (
                <div className="mt-4 pt-4 border-t border-gray-100">
                  <p className="text-xs font-medium text-gray-500 mb-2 flex items-center gap-1">
                    <List size={12} />
                    ХАРАКТЕРИСТИКИ:
                  </p>
                  <div className="space-y-2">
                    {category.fields.map((field) => {
                      const options = field.options ? JSON.parse(field.options) : [];
                      return (
                        <div key={field.id} className="flex items-center justify-between p-2 bg-gray-50 rounded-lg">
                          <div className="flex-1">
                            <p className="text-sm font-medium text-gray-900">{field.name}</p>
                            <p className="text-xs text-gray-500">
                              {field.fieldType === 'select' && options.length > 0 
                                ? `Варианты: ${options.join(', ')}` 
                                : field.fieldType === 'multiselect' 
                                  ? `Множественный выбор: ${options.join(', ')}`
                                  : field.fieldType === 'text' 
                                    ? 'Текстовое поле'
                                    : 'Числовое поле'}
                              {field.isRequired && ' • Обязательное'}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteField(field.id)}
                            className="p-1 text-red-500 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={14} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </CardBody>
          </Card>
        ))}
      </div>

      {categories.length === 0 && (
        <div className="text-center py-12 bg-white rounded-xl">
          <Package size={48} className="mx-auto mb-3 text-gray-300" />
          <p className="text-gray-500">Нет категорий</p>
          <p className="text-sm text-gray-400 mt-1">Создайте первую категорию</p>
        </div>
      )}

      {/* Модальное окно для категории */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={selectedCategory ? 'Редактировать категорию' : 'Создать категорию'}
      >
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Название категории"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            required
            placeholder="Например: Тюнинг, Запчасти, Аксессуары"
          />
          <Input
            label="Описание"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            placeholder="Описание категории"
          />
          <Input
            label="Порядок сортировки"
            type="number"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) })}
            placeholder="0"
          />
          <div className="flex gap-3 pt-4">
            <Button type="submit" fullWidth>
              {selectedCategory ? 'Сохранить' : 'Создать'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} fullWidth>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно для характеристик */}
      <Modal
        isOpen={fieldsModalOpen}
        onClose={() => setFieldsModalOpen(false)}
        title={`Характеристики категории: ${selectedCategory?.name}`}
        size="lg"
      >
        <div className="space-y-6 max-h-[70vh] overflow-y-auto">
          {/* Список существующих характеристик */}
          {selectedCategory?.fields && selectedCategory.fields.length > 0 && (
            <div className="space-y-3">
              <h3 className="font-medium text-gray-900 flex items-center gap-2">
                <List size={18} />
                Существующие характеристики
              </h3>
              {selectedCategory.fields.map((field) => {
                const options = field.options ? JSON.parse(field.options) : [];
                return (
                  <div key={field.id} className="flex items-start justify-between p-4 bg-gray-50 rounded-lg">
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <p className="font-medium text-gray-900">{field.name}</p>
                        {field.isRequired && (
                          <span className="text-xs text-red-500">Обязательное</span>
                        )}
                      </div>
                      <p className="text-sm text-gray-600">
                        Тип: {fieldTypes.find(t => t.value === field.fieldType)?.label || field.fieldType}
                      </p>
                      {options.length > 0 && (
                        <div className="mt-2">
                          <p className="text-xs text-gray-500 mb-1">Варианты:</p>
                          <div className="flex flex-wrap gap-1">
                            {options.map((opt, idx) => (
                              <span key={idx} className="px-2 py-0.5 bg-white rounded text-xs text-gray-600 border">
                                {opt}
                              </span>
                            ))}
                          </div>
                        </div>
                      )}
                    </div>
                    <button
                      onClick={() => handleDeleteField(field.id)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить характеристику"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}

          {/* Форма добавления новой характеристики */}
          <div className="border-t pt-6">
            <h3 className="font-medium text-gray-900 mb-4 flex items-center gap-2">
              <PlusCircle size={18} />
              Добавить характеристику
            </h3>
            <form onSubmit={handleFieldSubmit} className="space-y-4">
              <Input
                label="Название характеристики"
                value={fieldFormData.name}
                onChange={(e) => setFieldFormData({ ...fieldFormData, name: e.target.value })}
                placeholder="Например: Модель авто, Двигатель, Год выпуска"
                required
              />
              
              <div className="space-y-2">
                <label className="block text-sm font-medium text-gray-700">Тип поля</label>
                <select
                  value={fieldFormData.fieldType}
                  onChange={(e) => {
                    setFieldFormData({ ...fieldFormData, fieldType: e.target.value });
                    if (e.target.value === 'text' || e.target.value === 'number') {
                      setOptionsInput('');
                    }
                  }}
                  className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  {fieldTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500">
                  {fieldFormData.fieldType === 'select' && 'Пользователь сможет выбрать один вариант из списка'}
                  {fieldFormData.fieldType === 'multiselect' && 'Пользователь сможет выбрать несколько вариантов'}
                  {fieldFormData.fieldType === 'text' && 'Пользователь сможет ввести произвольный текст'}
                  {fieldFormData.fieldType === 'number' && 'Пользователь сможет ввести число'}
                </p>
              </div>

              {(fieldFormData.fieldType === 'select' || fieldFormData.fieldType === 'multiselect') && (
                <Input
                  label="Варианты (через запятую)"
                  value={optionsInput}
                  onChange={(e) => setOptionsInput(e.target.value)}
                  placeholder="BMW, Audi, Mercedes, Toyota, Lexus"
                  multiline
                  rows={3}
                />
              )}

              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={fieldFormData.isRequired}
                  onChange={(e) => setFieldFormData({ ...fieldFormData, isRequired: e.target.checked })}
                  className="w-4 h-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                />
                <span className="text-sm text-gray-700">Обязательное поле</span>
              </label>

              <div className="flex gap-3 pt-4">
                <Button type="submit" fullWidth>
                  Добавить характеристику
                </Button>
              </div>
            </form>
          </div>
        </div>
      </Modal>
    </div>
  );
};