// frontend/src/pages/Products.tsx
import React, { useState, useEffect } from 'react';
import { productsApi } from '../api/products';
import { categoriesApi } from '../api/categories';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { CostBreakdownEditor } from '../components/ui/CostBreakdownEditor';
import { formatPrice, getStockStatus, getMarginColor } from '../utils/formatters';
import { Product, Category, CategoryField, CostBreakdownItem, ProductCharacteristic } from '../types';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Package, 
  AlertCircle,
  Loader,
  Tag,
  ChevronDown,
  ChevronUp,
  Filter,
  Layers
} from 'lucide-react';
import toast from 'react-hot-toast';

interface ProductFormData {
  name: string;
  article: string;
  cost_price: number | string;
  retail_price: number | string;
  stock: number | string;
  min_stock: number | string;
  categoryIds: number[];
  description: string;
  costBreakdown: CostBreakdownItem[];
}

interface ProductsStats {
  total: number;
  totalStock: number;
  totalValue: number;
  lowStock: number;
}

export const Products: React.FC = () => {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategoryFields, setSelectedCategoryFields] = useState<CategoryField[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [formData, setFormData] = useState<ProductFormData>({
    name: '',
    article: '',
    cost_price: '',
    retail_price: '',
    stock: '',
    min_stock: '',
    categoryIds: [],
    description: '',
    costBreakdown: []
  });
  const [characteristics, setCharacteristics] = useState<ProductCharacteristic>({});

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      const { data } = await productsApi.getAll();
      setProducts(data);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Ошибка загрузки товаров');
    } finally {
      setLoading(false);
    }
  };

  const loadCategories = async (): Promise<void> => {
    try {
      const { data } = await categoriesApi.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const filterProducts = (product: Product): boolean => {
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (!searchLower) return true;
    
    if (product.name?.toLowerCase().includes(searchLower)) return true;
    if (product.article?.toLowerCase().includes(searchLower)) return true;
    if (product.categories?.some(cat => cat.name?.toLowerCase().includes(searchLower))) return true;
    
    if (product.characteristics) {
      for (const [key, value] of Object.entries(product.characteristics)) {
        const stringValue = Array.isArray(value) ? value.join(' ') : String(value);
        if (stringValue.toLowerCase().includes(searchLower)) {
          return true;
        }
      }
    }
    
    return false;
  };

  const filterByCategory = (product: Product): boolean => {
    if (!selectedCategoryFilter) return true;
    return product.categoryIds?.includes(parseInt(selectedCategoryFilter));
  };

  const filteredProducts = products
    .filter(filterProducts)
    .filter(filterByCategory);

  const handleOpenModal = (product: Product | null = null): void => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name || '',
        article: product.article || '',
        cost_price: product.cost_price || '',
        retail_price: product.retail_price || '',
        stock: product.stock || '',
        min_stock: product.min_stock || '',
        categoryIds: product.categoryIds || [],
        description: product.description || '',
        costBreakdown: product.costBreakdown || []
      });
      
      // Собираем характеристики со всех категорий товара
      const allCharacteristics: ProductCharacteristic = {};
      if (product.categories && product.categories.length > 0) {
        product.categories.forEach(category => {
          if (category.fields) {
            category.fields.forEach(field => {
              const value = product.characteristics?.[field.name];
              if (value !== undefined && value !== null && value !== '') {
                allCharacteristics[field.id] = value;
              }
            });
          }
        });
      }
      setCharacteristics(allCharacteristics);
      setSelectedCategoryFields([]);
    } else {
      setEditingProduct(null);
      setFormData({
        name: '',
        article: '',
        cost_price: '',
        retail_price: '',
        stock: '',
        min_stock: '',
        categoryIds: [],
        description: '',
        costBreakdown: []
      });
      setSelectedCategoryFields([]);
      setCharacteristics({});
    }
    setModalOpen(true);
  };

  const handleCategoryChange = (categoryIds: number[]): void => {
    setFormData({ ...formData, categoryIds });
    
    // Собираем все поля из выбранных категорий
    const selectedCategories = categories.filter(cat => categoryIds.includes(cat.id));
    const allFields: CategoryField[] = [];
    selectedCategories.forEach(cat => {
      if (cat.fields) {
        allFields.push(...cat.fields);
      }
    });
    
    // Удаляем дубликаты полей по id
    const uniqueFields: CategoryField[] = [];
    const fieldIds = new Set<number>();
    allFields.forEach(field => {
      if (!fieldIds.has(field.id)) {
        fieldIds.add(field.id);
        uniqueFields.push(field);
      }
    });
    
    setSelectedCategoryFields(uniqueFields);
    
    // Сохраняем существующие значения характеристик
    const newCharacteristics: ProductCharacteristic = {};
    uniqueFields.forEach(field => {
      if (characteristics[field.id] !== undefined) {
        newCharacteristics[field.id] = characteristics[field.id];
      }
    });
    setCharacteristics(newCharacteristics);
  };

  const handleCharacteristicChange = (
    fieldId: number, 
    value: string | number | string[] | React.ChangeEvent<HTMLInputElement | HTMLSelectElement>,
    fieldType: string
  ): void => {
    let processedValue: string | number | string[];
    
    if (fieldType === 'multiselect') {
      processedValue = Array.from((value as React.ChangeEvent<HTMLSelectElement>).target.selectedOptions, option => option.value);
    } else if (fieldType === 'checkbox') {
      processedValue = (value as React.ChangeEvent<HTMLInputElement>).target.checked.toString();
    } else {
      processedValue = (value as React.ChangeEvent<HTMLInputElement | HTMLSelectElement>).target?.value ?? value as string;
    }
    
    setCharacteristics({
      ...characteristics,
      [fieldId]: processedValue
    });
  };

  const handleCostBreakdownChange = (items: CostBreakdownItem[]): void => {
    const totalCost = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    
    setFormData(prev => ({
      ...prev,
      costBreakdown: items,
      cost_price: totalCost
    }));
  };

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    try {
      const data = {
        ...formData,
        cost_price: parseFloat(formData.cost_price as string),
        retail_price: parseFloat(formData.retail_price as string),
        stock: parseInt(formData.stock as string),
        min_stock: parseInt(formData.min_stock as string),
        categoryIds: formData.categoryIds,
        characteristics: characteristics,
        costBreakdown: formData.costBreakdown
      };

      if (editingProduct) {
        await productsApi.update(editingProduct.id, data);
        toast.success('Товар обновлен');
      } else {
        await productsApi.create(data);
        toast.success('Товар добавлен');
      }
      
      setModalOpen(false);
      loadProducts();
    } catch (error) {
      console.error('Error saving product:', error);
      toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Ошибка сохранения');
    }
  };

  const handleDelete = async (id: number, name: string): Promise<void> => {
    if (confirm(`Удалить товар "${name}"?`)) {
      try {
        await productsApi.delete(id);
        toast.success('Товар удален');
        loadProducts();
      } catch (error) {
        toast.error('Ошибка удаления');
      }
    }
  };

  const toggleRowExpand = (productId: number): void => {
    setExpandedRows(prev => ({
      ...prev,
      [productId]: !prev[productId]
    }));
  };

  const renderCategoriesCell = (product: Product): React.ReactNode => {
    if (!product.categories || product.categories.length === 0) {
      return <span className="text-gray-400 text-sm">—</span>;
    }
    
    return (
      <div className="flex flex-wrap gap-1">
        {product.categories.slice(0, 2).map(cat => (
          <span key={cat.id} className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700">
            {cat.name}
          </span>
        ))}
        {product.categories.length > 2 && (
          <span className="px-2 py-1 text-xs rounded-full bg-gray-100 text-gray-600">
            +{product.categories.length - 2}
          </span>
        )}
      </div>
    );
  };

  const renderCharacteristicsCell = (product: Product): React.ReactNode => {
    if (!product.characteristics || Object.keys(product.characteristics).length === 0) {
      return <span className="text-gray-400 text-sm">—</span>;
    }
    
    const entries = Object.entries(product.characteristics);
    const displayEntries = entries.slice(0, 2);
    const hasMore = entries.length > 2;
    
    return (
      <div className="space-y-1">
        {displayEntries.map(([key, value]) => (
          <div key={key} className="text-xs">
            <span className="font-medium text-gray-700">{key}:</span>{' '}
            <span className="text-gray-600">
              {Array.isArray(value) ? value.join(', ') : String(value)}
            </span>
          </div>
        ))}
        {hasMore && (
          <div className="text-xs text-primary-600">
            +{entries.length - 2} еще
          </div>
        )}
      </div>
    );
  };

  const renderExpandedCharacteristics = (product: Product): React.ReactNode => {
    if (!product.characteristics || Object.keys(product.characteristics).length === 0) {
      return (
        <div className="p-4 text-center text-gray-500">
          Нет характеристик
        </div>
      );
    }
    
    return (
      <div className="p-4 bg-gray-50 rounded-lg">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {Object.entries(product.characteristics).map(([key, value]) => (
            <div key={key} className="bg-white p-3 rounded-lg shadow-sm">
              <p className="text-xs font-medium text-gray-500 mb-1">{key}</p>
              <p className="text-sm text-gray-900">
                {Array.isArray(value) ? value.join(', ') : String(value)}
              </p>
            </div>
          ))}
        </div>
      </div>
    );
  };

  const renderCharacteristicsForm = (): React.ReactNode => {
    if (!selectedCategoryFields.length) return null;
    
    return (
      <div className="space-y-4 border-t border-gray-200 pt-4 mt-4">
        <h3 className="font-medium text-gray-900 flex items-center gap-2">
          <Tag size={18} className="text-primary-600" />
          Характеристики товара
        </h3>
        {selectedCategoryFields.map((field) => {
          const options = field.options ? JSON.parse(field.options as string) : [];
          const currentValue = characteristics[field.id] || 
            (field.fieldType === 'multiselect' ? [] : 
             field.fieldType === 'checkbox' ? false : '');
          
          switch (field.fieldType) {
            case 'select':
              return (
                <div key={field.id} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {field.name} {field.isRequired && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    value={currentValue as string}
                    onChange={(e) => handleCharacteristicChange(field.id, e, field.fieldType)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    required={field.isRequired}
                  >
                    <option value="">Выберите {field.name.toLowerCase()}</option>
                    {options.map((option: string) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                </div>
              );
              
            case 'multiselect':
              return (
                <div key={field.id} className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">
                    {field.name} {field.isRequired && <span className="text-red-500">*</span>}
                  </label>
                  <select
                    multiple
                    value={currentValue as string[]}
                    onChange={(e) => handleCharacteristicChange(field.id, e, field.fieldType)}
                    className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[100px]"
                    required={field.isRequired}
                    size={Math.min(options.length, 5)}
                  >
                    {options.map((option: string) => (
                      <option key={option} value={option}>{option}</option>
                    ))}
                  </select>
                  <p className="text-xs text-gray-500">Удерживайте Ctrl для выбора нескольких вариантов</p>
                </div>
              );
              
            case 'number':
              return (
                <Input
                  key={field.id}
                  label={`${field.name} ${field.isRequired ? '*' : ''}`}
                  type="number"
                  value={currentValue as string}
                  onChange={(e) => handleCharacteristicChange(field.id, e, field.fieldType)}
                  required={field.isRequired}
                  placeholder={`Введите ${field.name.toLowerCase()}`}
                />
              );
              
            default:
              return (
                <Input
                  key={field.id}
                  label={`${field.name} ${field.isRequired ? '*' : ''}`}
                  type="text"
                  value={currentValue as string}
                  onChange={(e) => handleCharacteristicChange(field.id, e, field.fieldType)}
                  required={field.isRequired}
                  placeholder={`Введите ${field.name.toLowerCase()}`}
                />
              );
          }
        })}
      </div>
    );
  };

  const stats: ProductsStats = {
    total: products.length,
    totalStock: products.reduce((sum, p) => sum + (p.stock || 0), 0),
    totalValue: products.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost_price || 0)), 0),
    lowStock: products.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length,
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
          <h1 className="text-3xl font-bold text-gray-900">Товары</h1>
          <p className="text-gray-500 mt-1">Управление складом и товарами</p>
        </div>
        <Button 
          onClick={() => handleOpenModal()} 
          icon={Plus}
          variant="primary"
          size="lg"
          className="shadow-lg"
        >
          Добавить товар
        </Button>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Всего товаров</p>
                <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
              </div>
              <Package size={32} className="text-primary-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Общий остаток</p>
                <p className="text-2xl font-bold text-gray-900">{stats.totalStock} шт.</p>
              </div>
              <Package size={32} className="text-blue-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Стоимость запасов</p>
                <p className="text-2xl font-bold text-gray-900">{formatPrice(stats.totalValue)}</p>
              </div>
              <Package size={32} className="text-green-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
        <Card>
          <CardBody className="p-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm text-gray-500">Низкий остаток</p>
                <p className="text-2xl font-bold text-yellow-600">{stats.lowStock}</p>
              </div>
              <AlertCircle size={32} className="text-yellow-600 opacity-50" />
            </div>
          </CardBody>
        </Card>
      </div>

      {/* Search and Filters */}
      <Card>
        <CardBody className="p-4">
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <Input
                type="text"
                placeholder="Поиск по названию, артикулу, категории или характеристикам..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
            >
              <Filter size={16} />
              {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
            </button>
            
            {showFilters && (
              <div className="pt-3 border-t border-gray-100">
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-gray-700">Фильтр по категории</label>
                  <select
                    value={selectedCategoryFilter}
                    onChange={(e) => setSelectedCategoryFilter(e.target.value)}
                    className="w-full md:w-64 px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                  >
                    <option value="">Все категории</option>
                    {categories.map(category => (
                      <option key={category.id} value={category.id}>
                        {category.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Products Table */}
      <Card>
        <CardBody className="p-0">
          <Table>
            <Thead>
              <Tr>
                <Th className="w-8"></Th>
                <Th>Артикул</Th>
                <Th>Название</Th>
                <Th>Категории</Th>
                <Th>Себест.</Th>
                <Th>Розница</Th>
                <Th>Маржа</Th>
                <Th>Остаток</Th>
                <Th>Характеристики</Th>
                <Th>Действия</Th>
              </Tr>
            </Thead>
            <Tbody>
              {filteredProducts.map((product) => {
                const margin = ((product.retail_price - product.cost_price) / product.cost_price) * 100;
                const stockStatus = getStockStatus(product.stock, product.min_stock);
                const isExpanded = expandedRows[product.id];
                const hasCharacteristics = product.characteristics && Object.keys(product.characteristics).length > 0;
                
                return (
                  <React.Fragment key={product.id}>
                    <Tr className="hover:bg-gray-50">
                      <Td className="w-8">
                        {hasCharacteristics && (
                          <button
                            onClick={() => toggleRowExpand(product.id)}
                            className="p-1 hover:bg-gray-200 rounded transition-colors"
                          >
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        )}
                      </Td>
                      <Td className="font-mono text-sm">{product.article}</Td>
                      <Td className="font-medium">{product.name}</Td>
                      <Td>{renderCategoriesCell(product)}</Td>
                      <Td>{formatPrice(product.cost_price)}</Td>
                      <Td>{formatPrice(product.retail_price)}</Td>
                      <Td>
                        <span className={`font-semibold ${getMarginColor(margin)}`}>
                          {margin.toFixed(1)}%
                        </span>
                      </Td>
                      <Td>
                        <span className={`px-2 py-1 rounded-full text-xs font-medium ${stockStatus.bg} ${stockStatus.color}`}>
                          {stockStatus.text} ({product.stock} шт.)
                        </span>
                      </Td>
                      <Td>
                        {renderCharacteristicsCell(product)}
                      </Td>
                      <Td>
                        <div className="flex gap-2">
                          <button
                            onClick={() => handleOpenModal(product)}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
                            title="Редактировать"
                          >
                            <Edit size={18} />
                          </button>
                          <button
                            onClick={() => handleDelete(product.id, product.name)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                            title="Удалить"
                          >
                            <Trash2 size={18} />
                          </button>
                        </div>
                      </Td>
                    </Tr>
                    {isExpanded && hasCharacteristics && (
                      <Tr className="bg-gray-50">
                        <Td colSpan={10} className="px-6 py-4">
                          {renderExpandedCharacteristics(product)}
                        </Td>
                      </Tr>
                    )}
                  </React.Fragment>
                );
              })}
            </Tbody>
          </Table>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package size={48} className="mx-auto mb-3 opacity-50" />
              <p>Товары не найдены</p>
              {searchTerm && (
                <p className="text-sm mt-2">Попробуйте изменить поисковый запрос</p>
              )}
            </div>
          )}
        </CardBody>
      </Card>

      {/* Modal for Add/Edit Product */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingProduct ? 'Редактировать товар' : 'Добавить товар'}
        size="lg"
      >
        <form onSubmit={handleSubmit} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Название товара"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
              placeholder="Введите название"
            />
            <Input
              label="Артикул"
              value={formData.article}
              onChange={(e) => setFormData({ ...formData, article: e.target.value })}
              required
              placeholder="Уникальный артикул"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Себестоимость (₽)"
              type="number"
              value={formData.cost_price}
              onChange={(e) => setFormData({ ...formData, cost_price: e.target.value })}
              required
              placeholder="0"
              step="0.01"
              disabled={formData.costBreakdown && formData.costBreakdown.length > 0}
            />
            <Input
              label="Розничная цена (₽)"
              type="number"
              value={formData.retail_price}
              onChange={(e) => setFormData({ ...formData, retail_price: e.target.value })}
              required
              placeholder="0"
              step="0.01"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Остаток на складе"
              type="number"
              value={formData.stock}
              onChange={(e) => setFormData({ ...formData, stock: e.target.value })}
              required
              placeholder="0"
            />
            <Input
              label="Минимальный остаток"
              type="number"
              value={formData.min_stock}
              onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
              required
              placeholder="5"
            />
          </div>
          
          <div className="space-y-2">
            <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
              <Layers size={16} />
              Категории (можно выбрать несколько)
            </label>
            <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
              {categories.map(category => (
                <label key={category.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
                  <input
                    type="checkbox"
                    value={category.id}
                    checked={formData.categoryIds.includes(category.id)}
                    onChange={(e) => {
                      const newCategoryIds = e.target.checked
                        ? [...formData.categoryIds, category.id]
                        : formData.categoryIds.filter(id => id !== category.id);
                      handleCategoryChange(newCategoryIds);
                    }}
                    className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
                  />
                  <span className="text-sm text-gray-700">
                    {category.name}
                    {category.fields && category.fields.length > 0 && (
                      <span className="text-xs text-gray-400 ml-1">({category.fields.length} полей)</span>
                    )}
                  </span>
                </label>
              ))}
            </div>
            {categories.length === 0 && (
              <p className="text-xs text-yellow-600 mt-1">
                Нет категорий. Сначала создайте категорию в разделе "Категории"
              </p>
            )}
            {formData.categoryIds.length > 0 && (
              <div className="flex flex-wrap gap-1 mt-2">
                {formData.categoryIds.map(catId => {
                  const cat = categories.find(c => c.id === catId);
                  return cat ? (
                    <span key={catId} className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700">
                      {cat.name}
                    </span>
                  ) : null;
                })}
              </div>
            )}
          </div>
          
          {/* Калькуляция себестоимости */}
          <div className="border-t border-gray-200 pt-4">
            <CostBreakdownEditor
              value={formData.costBreakdown}
              onChange={handleCostBreakdownChange}
              disabled={false}  
            />
          </div>
          
          {renderCharacteristicsForm()}
          
          <Input
            label="Описание"
            value={formData.description}
            onChange={(e) => setFormData({ ...formData, description: e.target.value })}
            multiline
            rows={3}
            placeholder="Дополнительная информация о товаре..."
          />
          
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white py-4 border-t border-gray-100">
            <Button type="submit" fullWidth>
              {editingProduct ? 'Сохранить изменения' : 'Добавить товар'}
            </Button>
            <Button type="button" variant="secondary" onClick={() => setModalOpen(false)} fullWidth>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default Products;