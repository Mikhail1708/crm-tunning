// frontend/src/pages/Products.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { productsApi } from '../api/products';
import { categoriesApi } from '../api/categories';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { Table, Thead, Tbody, Tr, Th, Td } from '../components/ui/Table';
import { ProductBasicForm } from '../components/ProductBasicForm';
import { ProductCategoriesSelector } from '../components/ProductCategoriesSelector';
import { ProductCharacteristicsForm } from '../components/ProductCharacteristicsForm';
import { CostBreakdownEditor } from '../components/ui/CostBreakdownEditor';
import { formatPrice, getStockStatus, getMarginColor } from '../utils/formatters';
import { Product, Category, CategoryField, CostBreakdownItem, ProductCharacteristic } from '../types';
import { useDebounce } from '../hooks/useDebounce';
import { 
  Plus, 
  Edit, 
  Trash2, 
  Search, 
  Package, 
  AlertCircle,
  Loader,
  Filter,
  ChevronDown,
  ChevronUp
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

// Мемоизированный компонент строки товара
const ProductRow = React.memo(({ 
  product, 
  isExpanded, 
  onToggleExpand, 
  onEdit, 
  onDelete 
}: { 
  product: Product; 
  isExpanded: boolean; 
  onToggleExpand: (id: number) => void;
  onEdit: (product: Product) => void;
  onDelete: (id: number, name: string) => void;
}) => {
  const margin = ((product.retail_price - product.cost_price) / product.cost_price) * 100;
  const stockStatus = getStockStatus(product.stock, product.min_stock);
  const hasCharacteristics = product.characteristics && Object.keys(product.characteristics).length > 0;

  const renderCategoriesCell = () => {
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

  const renderCharacteristicsCell = () => {
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
        {hasMore && <div className="text-xs text-primary-600">+{entries.length - 2} еще</div>}
      </div>
    );
  };

  const renderExpandedCharacteristics = () => {
    if (!product.characteristics || Object.keys(product.characteristics).length === 0) {
      return <div className="p-4 text-center text-gray-500">Нет характеристик</div>;
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

  return (
    <React.Fragment>
      <Tr className="hover:bg-gray-50">
        <Td className="w-8">
          {hasCharacteristics && (
            <button
              onClick={() => onToggleExpand(product.id)}
              className="p-1 hover:bg-gray-200 rounded transition-colors"
            >
              {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
            </button>
          )}
        </Td>
        <Td className="font-mono text-sm">{product.article}</Td>
        <Td className="font-medium">{product.name}</Td>
        <Td>{renderCategoriesCell()}</Td>
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
        <Td>{renderCharacteristicsCell()}</Td>
        <Td>
          <div className="flex gap-2">
            <button
              onClick={() => onEdit(product)}
              className="p-1 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Редактировать"
            >
              <Edit size={18} />
            </button>
            <button
              onClick={() => onDelete(product.id, product.name)}
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
            {renderExpandedCharacteristics()}
          </Td>
        </Tr>
      )}
    </React.Fragment>
  );
});

ProductRow.displayName = 'ProductRow';

// Мемоизированный компонент статистики
const StatsCards = React.memo(({ stats }: { stats: ProductsStats }) => (
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
));

StatsCards.displayName = 'StatsCards';

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

  const debouncedSearch = useDebounce(searchTerm, 300);

  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  const loadProducts = useCallback(async (): Promise<void> => {
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
  }, []);

  const loadCategories = useCallback(async (): Promise<void> => {
    try {
      const { data } = await categoriesApi.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  }, []);

  const filterProducts = useCallback((product: Product): boolean => {
    const searchLower = debouncedSearch.toLowerCase().trim();
    
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
  }, [debouncedSearch]);

  const filterByCategory = useCallback((product: Product): boolean => {
    if (!selectedCategoryFilter) return true;
    return product.categoryIds?.includes(parseInt(selectedCategoryFilter));
  }, [selectedCategoryFilter]);

  const filteredProducts = useMemo(() => {
    return products.filter(filterProducts).filter(filterByCategory);
  }, [products, filterProducts, filterByCategory]);

  const stats: ProductsStats = useMemo(() => ({
    total: products.length,
    totalStock: products.reduce((sum, p) => sum + (p.stock || 0), 0),
    totalValue: products.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost_price || 0)), 0),
    lowStock: products.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length,
  }), [products]);

  const handleBasicFieldChange = useCallback((field: keyof ProductFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleCategoryChange = useCallback((categoryIds: number[]) => {
    setFormData(prev => ({ ...prev, categoryIds }));
    
    const selectedCategories = categories.filter(cat => categoryIds.includes(cat.id));
    const allFields: CategoryField[] = [];
    selectedCategories.forEach(cat => {
      if (cat.fields) {
        allFields.push(...cat.fields);
      }
    });
    
    const uniqueFields: CategoryField[] = [];
    const fieldIds = new Set<number>();
    allFields.forEach(field => {
      if (!fieldIds.has(field.id)) {
        fieldIds.add(field.id);
        uniqueFields.push(field);
      }
    });
    
    setSelectedCategoryFields(uniqueFields);
    
    const newCharacteristics: ProductCharacteristic = {};
    uniqueFields.forEach(field => {
      if (characteristics[field.id] !== undefined) {
        newCharacteristics[field.id] = characteristics[field.id];
      }
    });
    setCharacteristics(newCharacteristics);
  }, [categories, characteristics]);

  const handleCharacteristicChange = useCallback((fieldId: number, value: string | number | string[]) => {
    setCharacteristics(prev => ({ ...prev, [fieldId]: value }));
  }, []);

  const handleCostBreakdownChange = useCallback((items: CostBreakdownItem[]) => {
    const totalCost = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    setFormData(prev => ({
      ...prev,
      costBreakdown: items,
      cost_price: totalCost
    }));
  }, []);

  const handleOpenModal = useCallback((product: Product | null = null) => {
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
  }, []);

  const handleSubmit = useCallback(async (e: React.FormEvent<HTMLFormElement>) => {
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
  }, [formData, characteristics, editingProduct, loadProducts]);

  const handleDelete = useCallback(async (id: number, name: string) => {
    if (confirm(`Удалить товар "${name}"?`)) {
      try {
        await productsApi.delete(id);
        toast.success('Товар удален');
        loadProducts();
      } catch (error) {
        toast.error('Ошибка удаления');
      }
    }
  }, [loadProducts]);

  const toggleRowExpand = useCallback((productId: number) => {
    setExpandedRows(prev => ({ ...prev, [productId]: !prev[productId] }));
  }, []);

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
      <StatsCards stats={stats} />

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
              {filteredProducts.map((product) => (
                <ProductRow
                  key={product.id}
                  product={product}
                  isExpanded={expandedRows[product.id]}
                  onToggleExpand={toggleRowExpand}
                  onEdit={handleOpenModal}
                  onDelete={handleDelete}
                />
              ))}
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
          <ProductBasicForm
            name={formData.name}
            article={formData.article}
            cost_price={formData.cost_price}
            retail_price={formData.retail_price}
            stock={formData.stock}
            min_stock={formData.min_stock}
            onChange={handleBasicFieldChange}
          />
          
          <ProductCategoriesSelector
            categories={categories}
            selectedCategoryIds={formData.categoryIds}
            onChange={handleCategoryChange}
          />
          
          <div className="border-t border-gray-200 pt-4">
            <CostBreakdownEditor
              value={formData.costBreakdown}
              onChange={handleCostBreakdownChange}
              disabled={false}
            />
          </div>
          
          <ProductCharacteristicsForm
            fields={selectedCategoryFields}
            characteristics={characteristics}
            onChange={handleCharacteristicChange}
          />
          
          <Input
            label="Описание"
            value={formData.description}
            onChange={(e) => handleBasicFieldChange('description', e.target.value)}
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