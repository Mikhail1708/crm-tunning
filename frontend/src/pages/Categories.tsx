// frontend/src/pages/Categories.tsx
import React, { useState, useEffect } from 'react';
import { categoriesApi } from '../api/categories';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Category, CategoryField } from '../types';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Loader,
  Package,
  List,
  X,
  PlusCircle,
  Save,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

interface CategoryFormData {
  name: string;
  description: string;
  icon: string;
  sortOrder: number;
}

interface FieldFormData {
  name: string;
  fieldType: 'text' | 'number' | 'select' | 'multiselect';
  isRequired: boolean;
  sortOrder: number;
  options: string[];
}

const fieldTypes = [
  { value: 'select' as const, label: 'Выпадающий список (один выбор)', icon: '📋' },
  { value: 'multiselect' as const, label: 'Множественный выбор', icon: '✅' },
  { value: 'text' as const, label: 'Текстовое поле', icon: '📝' },
  { value: 'number' as const, label: 'Числовое поле', icon: '🔢' }
];

export const Categories: React.FC = () => {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [fieldsModalOpen, setFieldsModalOpen] = useState<boolean>(false);
  const [editFieldModalOpen, setEditFieldModalOpen] = useState<boolean>(false);
  const [selectedCategory, setSelectedCategory] = useState<Category | null>(null);
  const [editingField, setEditingField] = useState<CategoryField | null>(null);
  const [expandedCategory, setExpandedCategory] = useState<number | null>(null);
  const [formData, setFormData] = useState<CategoryFormData>({
    name: '',
    description: '',
    icon: '',
    sortOrder: 0
  });
  const [fieldFormData, setFieldFormData] = useState<FieldFormData>({
    name: '',
    fieldType: 'select',
    isRequired: false,
    sortOrder: 0,
    options: []
  });
  const [optionsInput, setOptionsInput] = useState<string>('');

  useEffect(() => {
    loadCategories();
  }, []);

  const loadCategories = async (): Promise<void> => {
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

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
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

  const handleDelete = async (id: number, name: string): Promise<void> => {
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

  const handleFieldSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    let optionsArray: string[] = [];
    if (optionsInput.trim()) {
      optionsArray = optionsInput.split(',').map(opt => opt.trim()).filter(opt => opt);
    }
    
    const fieldData = {
      name: fieldFormData.name,
      fieldType: fieldFormData.fieldType,
      isRequired: fieldFormData.isRequired,
      sortOrder: fieldFormData.sortOrder,
      options: optionsArray
    };
    
    try {
      await categoriesApi.createField(selectedCategory!.id, fieldData);
      toast.success('Характеристика добавлена');
      setFieldsModalOpen(false);
      loadCategories();
      resetFieldForm();
    } catch (error) {
      console.error('Error creating field:', error);
      toast.error('Ошибка добавления характеристики');
    }
  };

  const handleEditField = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    let optionsArray: string[] = [];
    if (optionsInput.trim()) {
      optionsArray = optionsInput.split(',').map(opt => opt.trim()).filter(opt => opt);
    }
    
    const fieldData = {
      name: fieldFormData.name,
      fieldType: fieldFormData.fieldType,
      isRequired: fieldFormData.isRequired,
      sortOrder: fieldFormData.sortOrder,
      options: optionsArray
    };
    
    try {
      await categoriesApi.updateField(editingField!.id, fieldData);
      toast.success('Характеристика обновлена');
      setEditFieldModalOpen(false);
      loadCategories();
      resetFieldForm();
      setEditingField(null);
    } catch (error) {
      console.error('Error updating field:', error);
      toast.error('Ошибка обновления характеристики');
    }
  };

  const handleDeleteField = async (fieldId: number, fieldName: string): Promise<void> => {
    if (confirm(`Удалить характеристику "${fieldName}"? Все значения этой характеристики у товаров будут удалены.`)) {
      try {
        await categoriesApi.deleteField(fieldId);
        toast.success('Характеристика удалена');
        loadCategories();
      } catch (error) {
        toast.error('Ошибка удаления');
      }
    }
  };

  const openEditFieldModal = (field: CategoryField): void => {
    setEditingField(field);
    let optionsArray: string[] = [];
    if (field.options) {
      try {
        optionsArray = JSON.parse(field.options as string);
      } catch (e) {
        optionsArray = [];
      }
    }
    setFieldFormData({
      name: field.name,
      fieldType: field.fieldType,
      isRequired: field.isRequired,
      sortOrder: field.sortOrder || 0,
      options: optionsArray
    });
    setOptionsInput(optionsArray.join(', '));
    setEditFieldModalOpen(true);
  };

  const openAddFieldModal = (category: Category): void => {
    setSelectedCategory(category);
    resetFieldForm();
    setFieldsModalOpen(true);
  };

  const resetForm = (): void => {
    setSelectedCategory(null);
    setFormData({
      name: '',
      description: '',
      icon: '',
      sortOrder: 0
    });
  };

  const resetFieldForm = (): void => {
    setFieldFormData({
      name: '',
      fieldType: 'select',
      isRequired: false,
      sortOrder: 0,
      options: []
    });
    setOptionsInput('');
  };

  const getFieldTypeLabel = (fieldType: string): string => {
    const found = fieldTypes.find(t => t.value === fieldType);
    return found ? found.label : fieldType;
  };

  const getFieldTypeIcon = (fieldType: string): string => {
    const found = fieldTypes.find(t => t.value === fieldType);
    return found ? found.icon : '📌';
  };

  const toggleExpand = (categoryId: number): void => {
    if (expandedCategory === categoryId) {
      setExpandedCategory(null);
    } else {
      setExpandedCategory(categoryId);
    }
  };

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
        {categories.map((category) => {
          const isExpanded = expandedCategory === category.id;
          const hasFields = category.fields && category.fields.length > 0;
          
          return (
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
                      onClick={() => openAddFieldModal(category)}
                      className="p-2 text-green-500 hover:bg-green-50 rounded-lg transition-colors"
                      title="Добавить характеристику"
                    >
                      <Plus size={18} />
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
                      title="Редактировать категорию"
                    >
                      <Edit size={18} />
                    </button>
                    <button
                      onClick={() => handleDelete(category.id, category.name)}
                      className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      title="Удалить категорию"
                    >
                      <Trash2 size={18} />
                    </button>
                  </div>
                </div>
                
                {category.description && (
                  <p className="text-gray-600 text-sm mb-4">{category.description}</p>
                )}

                <div className="mt-4 pt-4 border-t border-gray-100">
                  <div 
                    className="flex items-center justify-between cursor-pointer"
                    onClick={() => toggleExpand(category.id)}
                  >
                    <p className="text-xs font-medium text-gray-500 flex items-center gap-1">
                      <List size={12} />
                      ХАРАКТЕРИСТИКИ ({category.fields?.length || 0})
                    </p>
                    {hasFields && (
                      <button className="text-gray-400 hover:text-gray-600">
                        {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                      </button>
                    )}
                  </div>
                  
                  {!hasFields && (
                    <p className="text-xs text-gray-400 mt-2 text-center py-2">
                      Нет характеристик. Нажмите <Plus size={12} className="inline" /> чтобы добавить
                    </p>
                  )}
                  
                  {hasFields && isExpanded && (
                    <div className="space-y-2 mt-3">
                      {category.fields!.map((field) => {
                        let options: string[] = [];
                        if (field.options) {
                          try {
                            options = JSON.parse(field.options as string);
                          } catch (e) {
                            options = [];
                          }
                        }
                        return (
                          <div key={field.id} className="flex items-center justify-between p-3 bg-gray-50 rounded-lg group">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="text-base">{getFieldTypeIcon(field.fieldType)}</span>
                                <p className="text-sm font-medium text-gray-900">{field.name}</p>
                                {field.isRequired && (
                                  <span className="text-xs px-1.5 py-0.5 bg-red-100 text-red-600 rounded">Обязательное</span>
                                )}
                                <span className="text-xs px-1.5 py-0.5 bg-gray-200 text-gray-600 rounded">
                                  {getFieldTypeLabel(field.fieldType)}
                                </span>
                              </div>
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
                            <div className="flex gap-1 ml-3">
                              <button
                                onClick={() => openEditFieldModal(field)}
                                className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-colors"
                                title="Редактировать характеристику"
                              >
                                <Edit size={14} />
                              </button>
                              <button
                                onClick={() => handleDeleteField(field.id, field.name)}
                                className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-colors"
                                title="Удалить характеристику"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </CardBody>
            </Card>
          );
        })}
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
            rows={3}
            placeholder="Описание категории"
          />
          <Input
            label="Порядок сортировки"
            type="number"
            value={formData.sortOrder}
            onChange={(e) => setFormData({ ...formData, sortOrder: parseInt(e.target.value) || 0 })}
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

      {/* Модальное окно для ДОБАВЛЕНИЯ характеристики */}
      <Modal
        isOpen={fieldsModalOpen}
        onClose={() => {
          setFieldsModalOpen(false);
          resetFieldForm();
        }}
        title={`Добавить характеристику для: ${selectedCategory?.name}`}
        size="lg"
      >
        <form onSubmit={handleFieldSubmit} className="space-y-4">
          <Input
            label="Название характеристики *"
            value={fieldFormData.name}
            onChange={(e) => setFieldFormData({ ...fieldFormData, name: e.target.value })}
            placeholder="Например: Модель авто, Двигатель, Год выпуска"
            required
          />
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Тип поля *</label>
            <div className="grid grid-cols-2 gap-2">
              {fieldTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setFieldFormData({ ...fieldFormData, fieldType: type.value });
                    if (type.value === 'text' || type.value === 'number') {
                      setOptionsInput('');
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    fieldFormData.fieldType === type.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-lg mb-1">{type.icon}</div>
                  <div className="text-sm font-medium">{type.label}</div>
                </button>
              ))}
            </div>
            <p className="text-xs text-gray-500 mt-2">
              {fieldFormData.fieldType === 'select' && '📋 Пользователь сможет выбрать ОДИН вариант из списка'}
              {fieldFormData.fieldType === 'multiselect' && '✅ Пользователь сможет выбрать НЕСКОЛЬКО вариантов'}
              {fieldFormData.fieldType === 'text' && '📝 Пользователь сможет ввести произвольный текст'}
              {fieldFormData.fieldType === 'number' && '🔢 Пользователь сможет ввести число'}
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
            <span className="text-sm text-gray-700">Обязательное поле (пользователь должен заполнить)</span>
          </label>

          <Input
            label="Порядок сортировки"
            type="number"
            value={fieldFormData.sortOrder}
            onChange={(e) => setFieldFormData({ ...fieldFormData, sortOrder: parseInt(e.target.value) || 0 })}
            placeholder="0 - будет выше в списке"
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" icon={PlusCircle} fullWidth>
              Добавить характеристику
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => {
                setFieldsModalOpen(false);
                resetFieldForm();
              }} 
              fullWidth
            >
              Отмена
            </Button>
          </div>
        </form>
      </Modal>

      {/* Модальное окно для РЕДАКТИРОВАНИЯ характеристики */}
      <Modal
        isOpen={editFieldModalOpen}
        onClose={() => {
          setEditFieldModalOpen(false);
          resetFieldForm();
          setEditingField(null);
        }}
        title={`Редактировать характеристику: ${editingField?.name}`}
        size="lg"
      >
        <form onSubmit={handleEditField} className="space-y-4">
          <Input
            label="Название характеристики *"
            value={fieldFormData.name}
            onChange={(e) => setFieldFormData({ ...fieldFormData, name: e.target.value })}
            required
            placeholder="Например: Модель авто, Двигатель, Год выпуска"
          />
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">Тип поля *</label>
            <div className="grid grid-cols-2 gap-2">
              {fieldTypes.map(type => (
                <button
                  key={type.value}
                  type="button"
                  onClick={() => {
                    setFieldFormData({ ...fieldFormData, fieldType: type.value });
                    if (type.value === 'text' || type.value === 'number') {
                      setOptionsInput('');
                    }
                  }}
                  className={`p-3 rounded-lg border text-left transition-all ${
                    fieldFormData.fieldType === type.value
                      ? 'border-primary-500 bg-primary-50 text-primary-700'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="text-lg mb-1">{type.icon}</div>
                  <div className="text-sm font-medium">{type.label}</div>
                </button>
              ))}
            </div>
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

          <Input
            label="Порядок сортировки"
            type="number"
            value={fieldFormData.sortOrder}
            onChange={(e) => setFieldFormData({ ...fieldFormData, sortOrder: parseInt(e.target.value) || 0 })}
            placeholder="0"
          />

          <div className="flex gap-3 pt-4">
            <Button type="submit" icon={Save} fullWidth>
              Сохранить изменения
            </Button>
            <Button 
              type="button" 
              variant="secondary" 
              onClick={() => {
                setEditFieldModalOpen(false);
                resetFieldForm();
                setEditingField(null);
              }} 
              fullWidth
            >
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Categories;