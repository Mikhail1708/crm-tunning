// frontend/src/pages/Products.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useSearchParams } from 'react-router-dom';
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
  ChevronUp,
  X,
  SlidersHorizontal,
  Tag,
  DollarSign,
  Boxes,
  RefreshCw,
  CheckSquare,
  Square
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

interface FilterState {
  search: string;
  categoryIds: number[];
  priceMin: number | '';
  priceMax: number | '';
  stockStatus: 'all' | 'low' | 'out' | 'in';
  characteristics: Record<string, string | string[]>;
}

// Компонент фильтра по характеристикам
interface CharacteristicFilterProps {
  fields: CategoryField[];
  values: Record<string, string | string[]>;
  onChange: (fieldId: string, value: string | string[]) => void;
  onClear: (fieldId: string) => void;
}

const CharacteristicFilter: React.FC<CharacteristicFilterProps> = ({ fields, values, onChange, onClear }) => {
  if (fields.length === 0) return null;

  return (
    <div className="space-y-4">
      <h4 className="font-medium text-gray-700 text-sm flex items-center gap-2">
        <Tag size={14} />
        Характеристики
      </h4>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {fields.map((field) => {
          const currentValue = values[field.id] || '';
          
          if (field.fieldType === 'select' || field.fieldType === 'multiselect') {
            let options: string[] = [];
            if (field.options) {
              if (typeof field.options === 'string') {
                try {
                  options = JSON.parse(field.options);
                } catch {
                  options = field.options.split(',').map(s => s.trim());
                }
              } else if (Array.isArray(field.options)) {
                options = field.options;
              }
            }
            
            return (
              <div key={field.id} className="space-y-1">
                <label className="text-xs font-medium text-gray-600">{field.name}</label>
                <select
                  value={typeof currentValue === 'string' ? currentValue : ''}
                  onChange={(e) => onChange(field.id.toString(), e.target.value)}
                  className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Все</option>
                  {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                {currentValue && (
                  <button
                    onClick={() => onClear(field.id.toString())}
                    className="text-xs text-red-500 hover:text-red-600"
                  >
                    Очистить
                  </button>
                )}
              </div>
            );
          }
          
          return (
            <div key={field.id} className="space-y-1">
              <label className="text-xs font-medium text-gray-600">{field.name}</label>
              <input
                type="text"
                value={currentValue as string || ''}
                onChange={(e) => onChange(field.id.toString(), e.target.value)}
                placeholder={`Фильтр по ${field.name.toLowerCase()}`}
                className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
              {currentValue && (
                <button
                  onClick={() => onClear(field.id.toString())}
                  className="text-xs text-red-500 hover:text-red-600"
                >
                  Очистить
                </button>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Компонент выбора нескольких категорий
interface CategoryMultiSelectProps {
  categories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
}

const CategoryMultiSelect: React.FC<CategoryMultiSelectProps> = ({ categories, selectedIds, onChange }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleCategory = (categoryId: number) => {
    if (selectedIds.includes(categoryId)) {
      onChange(selectedIds.filter(id => id !== categoryId));
    } else {
      onChange([...selectedIds, categoryId]);
    }
  };

  const selectedCategories = categories.filter(c => selectedIds.includes(c.id));
  const displayText = selectedCategories.length === 0 
    ? 'Все категории' 
    : selectedCategories.map(c => c.name).join(', ');

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-4 py-2 text-left rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 flex items-center justify-between bg-white"
      >
        <span className="text-sm truncate">{displayText}</span>
        <ChevronDown size={16} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>
      
      {isOpen && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
          <div className="p-2 border-b border-gray-100">
            <button
              type="button"
              onClick={() => onChange([])}
              className="text-xs text-primary-600 hover:text-primary-700"
            >
              Сбросить все
            </button>
          </div>
          {categories.map(category => (
            <div
              key={category.id}
              onClick={() => toggleCategory(category.id)}
              className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer"
            >
              {selectedIds.includes(category.id) ? (
                <CheckSquare size={16} className="text-primary-600" />
              ) : (
                <Square size={16} className="text-gray-400" />
              )}
              <span className="text-sm">{category.name}</span>
              {category._count?.products !== undefined && (
                <span className="text-xs text-gray-400 ml-auto">({category._count.products})</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

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
  const margin = product.cost_price > 0 
    ? ((product.retail_price - product.cost_price) / product.cost_price) * 100 
    : 0;
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

// Компонент статистики
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
          <Boxes size={32} className="text-blue-600 opacity-50" />
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
          <DollarSign size={32} className="text-green-600 opacity-50" />
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
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [modalOpen, setModalOpen] = useState<boolean>(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [selectedCategoryFields, setSelectedCategoryFields] = useState<CategoryField[]>([]);
  const [expandedRows, setExpandedRows] = useState<Record<number, boolean>>({});
  const [showFilters, setShowFilters] = useState<boolean>(() => {
    return searchParams.toString().length > 0;
  });
  
  // Фильтры
  const [filters, setFilters] = useState<FilterState>({
    search: searchParams.get('search') || '',
    categoryIds: searchParams.get('categories')?.split(',').map(Number).filter(Boolean) || [],
    priceMin: searchParams.get('priceMin') ? Number(searchParams.get('priceMin')) : '',
    priceMax: searchParams.get('priceMax') ? Number(searchParams.get('priceMax')) : '',
    stockStatus: (searchParams.get('stockStatus') as any) || 'all',
    characteristics: {}
  });

  const debouncedSearch = useDebounce(filters.search, 300);

  // Форма товара
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

  // Получение уникальных полей характеристик из выбранных категорий
  const availableCharacteristicFields = useMemo(() => {
    const fieldsMap = new Map<number, CategoryField>();
    categories.forEach(category => {
      if (filters.categoryIds.includes(category.id) && category.fields) {
        category.fields.forEach(field => {
          if (!fieldsMap.has(field.id)) {
            fieldsMap.set(field.id, field);
          }
        });
      }
    });
    return Array.from(fieldsMap.values());
  }, [categories, filters.categoryIds]);

  // Сохранение фильтров в URL
  const updateUrlParams = useCallback((newFilters: FilterState) => {
    const params: Record<string, string> = {};
    if (newFilters.search) params.search = newFilters.search;
    if (newFilters.categoryIds.length > 0) params.categories = newFilters.categoryIds.join(',');
    if (newFilters.priceMin) params.priceMin = String(newFilters.priceMin);
    if (newFilters.priceMax) params.priceMax = String(newFilters.priceMax);
    if (newFilters.stockStatus !== 'all') params.stockStatus = newFilters.stockStatus;
    setSearchParams(params);
  }, [setSearchParams]);

  // Загрузка данных
  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  // Синхронизация фильтров с URL
  useEffect(() => {
    updateUrlParams(filters);
  }, [filters.search, filters.categoryIds, filters.priceMin, filters.priceMax, filters.stockStatus, updateUrlParams]);

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

  // Фильтрация товаров
  const filteredProducts = useMemo(() => {
    let filtered = [...products];
    
    // Поиск по тексту
    if (debouncedSearch) {
      const searchLower = debouncedSearch.toLowerCase();
      filtered = filtered.filter(product => {
        if (product.name?.toLowerCase().includes(searchLower)) return true;
        if (product.article?.toLowerCase().includes(searchLower)) return true;
        if (product.categories?.some(cat => cat.name?.toLowerCase().includes(searchLower))) return true;
        if (product.characteristics) {
          for (const [, value] of Object.entries(product.characteristics)) {
            const stringValue = Array.isArray(value) ? value.join(' ') : String(value);
            if (stringValue.toLowerCase().includes(searchLower)) return true;
          }
        }
        return false;
      });
    }
    
    // Фильтр по категориям (если выбраны)
    if (filters.categoryIds.length > 0) {
      filtered = filtered.filter(product => {
        const productCategoryIds = product.categories?.map(c => c.id) || product.categoryIds || [];
        return filters.categoryIds.some(catId => productCategoryIds.includes(catId));
      });
    }
    
    // Фильтр по цене
    if (filters.priceMin !== '') {
      filtered = filtered.filter(product => product.retail_price >= filters.priceMin);
    }
    if (filters.priceMax !== '') {
      filtered = filtered.filter(product => product.retail_price <= filters.priceMax);
    }
    
    // Фильтр по остатку
    if (filters.stockStatus !== 'all') {
      filtered = filtered.filter(product => {
        if (filters.stockStatus === 'low') return product.stock <= (product.min_stock || 5);
        if (filters.stockStatus === 'out') return product.stock === 0;
        if (filters.stockStatus === 'in') return product.stock > 0;
        return true;
      });
    }
    
    // Фильтр по характеристикам
    if (Object.keys(filters.characteristics).length > 0) {
      filtered = filtered.filter(product => {
        const productChars = product.characteristics || {};
        for (const [fieldId, filterValue] of Object.entries(filters.characteristics)) {
          if (!filterValue) continue;
          
          const field = availableCharacteristicFields.find(f => f.id.toString() === fieldId);
          if (!field) continue;
          
          const productValue = productChars[field.name];
          if (!productValue) return false;
          
          if (field.fieldType === 'multiselect' && Array.isArray(filterValue)) {
            const productValues = Array.isArray(productValue) ? productValue : [String(productValue)];
            const hasMatch = filterValue.some(v => productValues.includes(v));
            if (!hasMatch) return false;
          } else if (typeof filterValue === 'string') {
            const productValueStr = Array.isArray(productValue) ? productValue.join(', ') : String(productValue);
            if (!productValueStr.toLowerCase().includes(filterValue.toLowerCase())) return false;
          }
        }
        return true;
      });
    }
    
    return filtered;
  }, [products, debouncedSearch, filters, availableCharacteristicFields]);

  // Подсчёт статистики для отфильтрованных товаров
  const stats: ProductsStats = useMemo(() => ({
    total: filteredProducts.length,
    totalStock: filteredProducts.reduce((sum, p) => sum + (p.stock || 0), 0),
    totalValue: filteredProducts.reduce((sum, p) => sum + ((p.stock || 0) * (p.cost_price || 0)), 0),
    lowStock: filteredProducts.filter(p => (p.stock || 0) <= (p.min_stock || 0)).length,
  }), [filteredProducts]);

  // Сброс всех фильтров
  const clearAllFilters = useCallback(() => {
    setFilters({
      search: '',
      categoryIds: [],
      priceMin: '',
      priceMax: '',
      stockStatus: 'all',
      characteristics: {}
    });
    toast.success('Все фильтры сброшены');
  }, []);

  // Обновление фильтра характеристик
  const handleCharacteristicFilterChange = useCallback((fieldId: string, value: string | string[]) => {
    setFilters(prev => ({
      ...prev,
      characteristics: {
        ...prev.characteristics,
        [fieldId]: value || ''
      }
    }));
  }, []);

  const handleClearCharacteristicFilter = useCallback((fieldId: string) => {
    setFilters(prev => {
      const newChars = { ...prev.characteristics };
      delete newChars[fieldId];
      return { ...prev, characteristics: newChars };
    });
  }, []);

  // Форма товара
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

  const hasActiveFilters = filters.search || filters.categoryIds.length > 0 || filters.priceMin !== '' || filters.priceMax !== '' || filters.stockStatus !== 'all' || Object.keys(filters.characteristics).length > 0;

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
            {/* Поисковая строка */}
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={20} />
              <Input
                type="text"
                placeholder="Поиск по названию, артикулу, категории или характеристикам..."
                value={filters.search}
                onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                className="pl-10"
              />
            </div>
            
            {/* Кнопка показа/скрытия фильтров и сброс */}
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600 transition-colors"
              >
                <SlidersHorizontal size={16} />
                {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
                {hasActiveFilters && !showFilters && (
                  <span className="ml-1 w-2 h-2 bg-primary-500 rounded-full"></span>
                )}
              </button>
              
              {hasActiveFilters && (
                <button
                  onClick={clearAllFilters}
                  className="flex items-center gap-2 text-sm text-red-500 hover:text-red-600 transition-colors"
                >
                  <RefreshCw size={14} />
                  Сбросить все фильтры
                </button>
              )}
            </div>
            
            {/* Расширенные фильтры */}
            {showFilters && (
              <div className="pt-3 border-t border-gray-100 space-y-4">
                {/* Категории */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Tag size={14} />
                    Категории (можно выбрать несколько)
                  </label>
                  <CategoryMultiSelect
                    categories={categories}
                    selectedIds={filters.categoryIds}
                    onChange={(ids) => setFilters(prev => ({ ...prev, categoryIds: ids }))}
                  />
                </div>
                
                {/* Цена */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <DollarSign size={14} />
                    Цена (розничная)
                  </label>
                  <div className="flex gap-3">
                    <input
                      type="number"
                      placeholder="от"
                      value={filters.priceMin === '' ? '' : filters.priceMin}
                      onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                    <input
                      type="number"
                      placeholder="до"
                      value={filters.priceMax === '' ? '' : filters.priceMax}
                      onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value === '' ? '' : Number(e.target.value) }))}
                      className="w-full px-3 py-2 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                    />
                  </div>
                </div>
                
                {/* Статус остатка */}
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2 flex items-center gap-2">
                    <Boxes size={14} />
                    Остаток на складе
                  </label>
                  <div className="flex flex-wrap gap-2">
                    {[
                      { value: 'all', label: 'Все', color: 'gray' },
                      { value: 'in', label: 'В наличии (>0)', color: 'green' },
                      { value: 'low', label: 'Низкий остаток', color: 'yellow' },
                      { value: 'out', label: 'Нет в наличии', color: 'red' }
                    ].map(option => (
                      <button
                        key={option.value}
                        onClick={() => setFilters(prev => ({ ...prev, stockStatus: option.value as any }))}
                        className={`px-3 py-1.5 text-sm rounded-full transition-colors ${
                          filters.stockStatus === option.value
                            ? `bg-${option.color}-600 text-white`
                            : `bg-${option.color}-50 text-${option.color}-700 hover:bg-${option.color}-100`
                        }`}
                      >
                        {option.label}
                      </button>
                    ))}
                  </div>
                </div>
                
                {/* Характеристики (динамические из выбранных категорий) */}
                {availableCharacteristicFields.length > 0 && (
                  <CharacteristicFilter
                    fields={availableCharacteristicFields}
                    values={filters.characteristics}
                    onChange={handleCharacteristicFilterChange}
                    onClear={handleClearCharacteristicFilter}
                  />
                )}
                
                {/* Индикатор активных фильтров */}
                {hasActiveFilters && (
                  <div className="pt-2 flex flex-wrap gap-2">
                    {filters.categoryIds.map(id => {
                      const cat = categories.find(c => c.id === id);
                      return cat && (
                        <span key={id} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-primary-100 text-primary-700 rounded-full">
                          {cat.name}
                          <button onClick={() => setFilters(prev => ({ ...prev, categoryIds: prev.categoryIds.filter(i => i !== id) }))}>
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    {(filters.priceMin !== '' || filters.priceMax !== '') && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-blue-100 text-blue-700 rounded-full">
                        Цена: {filters.priceMin || '0'} - {filters.priceMax || '∞'}
                        <button onClick={() => setFilters(prev => ({ ...prev, priceMin: '', priceMax: '' }))}>
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {filters.stockStatus !== 'all' && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                        {filters.stockStatus === 'in' && 'В наличии'}
                        {filters.stockStatus === 'low' && 'Низкий остаток'}
                        {filters.stockStatus === 'out' && 'Нет в наличии'}
                        <button onClick={() => setFilters(prev => ({ ...prev, stockStatus: 'all' }))}>
                          <X size={12} />
                        </button>
                      </span>
                    )}
                    {Object.entries(filters.characteristics).map(([fieldId, value]) => {
                      const field = availableCharacteristicFields.find(f => f.id.toString() === fieldId);
                      return field && value && (
                        <span key={fieldId} className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-purple-100 text-purple-700 rounded-full">
                          {field.name}: {Array.isArray(value) ? value.join(', ') : value}
                          <button onClick={() => handleClearCharacteristicFilter(fieldId)}>
                            <X size={12} />
                          </button>
                        </span>
                      );
                    })}
                    {filters.search && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 text-xs bg-gray-100 text-gray-700 rounded-full">
                        Поиск: {filters.search}
                        <button onClick={() => setFilters(prev => ({ ...prev, search: '' }))}>
                          <X size={12} />
                        </button>
                      </span>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </CardBody>
      </Card>

      {/* Products Table */}
      <Card>
        <CardBody className="p-0">
          <div className="overflow-x-auto">
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
          </div>
          {filteredProducts.length === 0 && (
            <div className="text-center py-12 text-gray-500">
              <Package size={48} className="mx-auto mb-3 opacity-50" />
              <p>Товары не найдены</p>
              {hasActiveFilters && (
                <p className="text-sm mt-2">
                  Попробуйте изменить параметры фильтрации
                  <button
                    onClick={clearAllFilters}
                    className="ml-2 text-primary-600 hover:underline"
                  >
                    Сбросить фильтры
                  </button>
                </p>
              )}
              {filters.search && !hasActiveFilters && (
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