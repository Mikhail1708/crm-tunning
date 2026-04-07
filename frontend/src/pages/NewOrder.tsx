// frontend/src/pages/NewOrder.tsx
import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import { productsApi } from '../api/products';
import { categoriesApi } from '../api/categories';
import { saleDocumentsApi } from '../api/saleDocuments';
import { clientsApi } from '../api/clients';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatPrice } from '../utils/formatters';
import { Product, Category, CategoryField, Client } from '../types';
import { 
  Plus, 
  Minus, 
  Trash2, 
  Search, 
  User,
  Phone,
  Mail,
  CreditCard,
  ArrowLeft,
  Save,
  ShoppingCart,
  Package,
  Users,
  X,
  Percent,
  AlertCircle,
  CheckCircle,
  MapPin,
  AlignLeft,
  Filter,
  SlidersHorizontal,
  Tag,
  DollarSign,
  Boxes,
  RefreshCw,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import toast from 'react-hot-toast';

// Типы для корзины
interface CartItem {
  id: number;
  name: string;
  article: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  stock: number;
}

interface Totals {
  subtotal: number;
  discountAmount: number;
  totalWithDiscount: number;
  totalProfit: number;
  discountPercent: number;
}

interface FilterState {
  search: string;
  categoryIds: number[];
  priceMin: number | '';
  priceMax: number | '';
  stockStatus: 'all' | 'low' | 'out' | 'in';
  characteristics: Record<string, string | string[]>;
}

// Функция валидации телефона
const validatePhone = (phone: string): string | null => {
  if (!phone) return 'Телефон обязателен';
  
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 0) return 'Введите номер телефона';
  if (digits.length < 10) return 'Номер телефона должен содержать минимум 10 цифр';
  if (digits.length > 12) return 'Номер телефона слишком длинный';
  
  return null;
};

// Функция форматирования телефона
const formatPhone = (value: string): string => {
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  if (digits.length <= 1) return `+7`;
  if (digits.length <= 4) return `+7 (${digits.slice(1, 4)}`;
  if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}`;
  if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}`;
  
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
};

// Функция для правильного разбора ФИО
const parseFullName = (fullName: string): { firstName: string; lastName: string; middleName: string } => {
  if (!fullName || !fullName.trim()) {
    return { firstName: '', lastName: '', middleName: '' };
  }
  
  const parts = fullName.trim().split(/\s+/);
  
  let firstName = '';
  let lastName = '';
  let middleName = '';
  
  if (parts.length === 1) {
    firstName = parts[0];
  } else if (parts.length === 2) {
    firstName = parts[0];
    lastName = parts[1];
  } else if (parts.length === 3) {
    lastName = parts[0];
    firstName = parts[1];
    middleName = parts[2];
  } else {
    lastName = parts.slice(0, parts.length - 2).join(' ');
    firstName = parts[parts.length - 2];
    middleName = parts[parts.length - 1];
  }
  
  return { firstName, lastName, middleName };
};

// Компонент выбора нескольких категорий
interface CategoryMultiSelectProps {
  categories: Category[];
  selectedIds: number[];
  onChange: (ids: number[]) => void;
  className?: string;
}

const CategoryMultiSelect: React.FC<CategoryMultiSelectProps> = ({ categories, selectedIds, onChange, className }) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

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
    <div className={`relative ${className || ''}`} ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-3 py-2 text-left rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 flex items-center justify-between bg-white text-sm"
      >
        <span className="truncate">{displayText}</span>
        <ChevronDown size={14} className={`text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
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
                <CheckCircle size={14} className="text-primary-600" />
              ) : (
                <div className="w-3.5 h-3.5 rounded-full border border-gray-300" />
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
    <div className="space-y-3">
      <h4 className="font-medium text-gray-700 text-xs flex items-center gap-1">
        <Tag size={12} />
        Характеристики
      </h4>
      <div className="grid grid-cols-2 gap-2">
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
              <div key={field.id} className="space-y-0.5">
                <label className="text-xs text-gray-500">{field.name}</label>
                <select
                  value={typeof currentValue === 'string' ? currentValue : ''}
                  onChange={(e) => onChange(field.id.toString(), e.target.value)}
                  className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                >
                  <option value="">Все</option>
                  {options.map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
              </div>
            );
          }
          
          return (
            <div key={field.id} className="space-y-0.5">
              <label className="text-xs text-gray-500">{field.name}</label>
              <input
                type="text"
                value={currentValue as string || ''}
                onChange={(e) => onChange(field.id.toString(), e.target.value)}
                placeholder="Любое значение"
                className="w-full px-2 py-1 text-xs rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              />
            </div>
          );
        })}
      </div>
    </div>
  );
};

// Компонент поиска клиента
interface ClientSearchProps {
  selectedClient: Client | null;
  onSelect: (client: Client) => void;
  onClear: () => void;
}

const ClientSearch: React.FC<ClientSearchProps> = ({ selectedClient, onSelect, onClear }) => {
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [results, setResults] = useState<Client[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showResults, setShowResults] = useState<boolean>(false);
  const searchRef = useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
        setShowResults(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  React.useEffect(() => {
    const search = async () => {
      if (searchQuery.length < 2) {
        setResults([]);
        return;
      }
      
      setLoading(true);
      try {
        const response = await clientsApi.search(searchQuery);
        setResults(response.data.clients);
        setShowResults(true);
      } catch (error) {
        console.error('Error searching clients:', error);
      } finally {
        setLoading(false);
      }
    };
    
    const timeoutId = setTimeout(search, 300);
    return () => clearTimeout(timeoutId);
  }, [searchQuery]);

  if (selectedClient) {
    const fullName = [selectedClient.lastName, selectedClient.firstName, selectedClient.middleName]
      .filter(Boolean)
      .join(' ')
      .trim() || selectedClient.firstName;
    
    return (
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-2">
        <div className="flex justify-between items-start">
          <div className="flex-1">
            <p className="font-medium text-gray-900 text-sm">{fullName}</p>
            <p className="text-xs text-gray-600 mt-0.5">📞 {selectedClient.phone}</p>
            {selectedClient.city && (
              <p className="text-xs text-gray-600">🏙️ {selectedClient.city}</p>
            )}
            {selectedClient.discountPercent && selectedClient.discountPercent > 0 && (
              <p className="text-xs text-green-600 mt-0.5">🎯 Скидка: {selectedClient.discountPercent}%</p>
            )}
          </div>
          <button onClick={onClear} className="p-1 hover:bg-blue-100 rounded">
            <X size={14} className="text-gray-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
        <input
          type="text"
          placeholder="Поиск клиента по имени или телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />
      </div>
      
      {showResults && (results.length > 0 || loading) && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-2 text-center text-gray-500 text-xs">Поиск...</div>
          ) : (
            results.map(client => {
              const fullName = [client.lastName, client.firstName, client.middleName]
                .filter(Boolean)
                .join(' ')
                .trim() || client.firstName;
              return (
                <div
                  key={client.id}
                  className="p-2 hover:bg-gray-50 cursor-pointer border-b last:border-0"
                  onClick={() => {
                    onSelect(client);
                    setSearchQuery('');
                    setShowResults(false);
                  }}
                >
                  <div className="font-medium text-sm">{fullName}</div>
                  <div className="text-xs text-gray-500">{client.phone}</div>
                  {client.discountPercent && client.discountPercent > 0 && (
                    <div className="text-xs text-green-600">Скидка: {client.discountPercent}%</div>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
};

// Компонент строки товара в каталоге с возможностью добавления
interface ProductRowProps {
  product: Product;
  isInCart: boolean;
  onAddToCart: (product: Product, quantity: number, price: number) => void;
}

const ProductRow: React.FC<ProductRowProps> = ({ product, isInCart, onAddToCart }) => {
  const [quantity, setQuantity] = useState<number>(1);
  const [price, setPrice] = useState<number>(product.retail_price);
  const [quantityError, setQuantityError] = useState<string>('');
  const [priceError, setPriceError] = useState<string>('');

  const validateQuantity = (value: number): string => {
    if (isNaN(value) || value < 1) return 'Количество > 0';
    if (value > product.stock) return `Доступно ${product.stock} шт.`;
    return '';
  };

  const validatePrice = (value: number): string => {
    if (isNaN(value) || value <= 0) return 'Цена > 0';
    if (value < product.cost_price) return `Не ниже ${formatPrice(product.cost_price)}`;
    return '';
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setQuantity(val);
    setQuantityError(validateQuantity(val));
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPrice(val);
    setPriceError(validatePrice(val));
  };

  const handleAdd = () => {
    const qty = quantity;
    const prc = price;
    
    const qtyError = validateQuantity(qty);
    const prcError = validatePrice(prc);
    
    if (qtyError) {
      toast.error(qtyError);
      return;
    }
    if (prcError) {
      toast.error(prcError);
      return;
    }
    
    onAddToCart(product, qty, prc);
    setQuantity(1);
    setPrice(product.retail_price);
    setQuantityError('');
    setPriceError('');
  };

  const margin = product.cost_price > 0 
    ? ((product.retail_price - product.cost_price) / product.cost_price) * 100 
    : 0;

  return (
    <div className={`border-b border-gray-100 p-3 hover:bg-gray-50 transition-colors ${isInCart ? 'bg-green-50' : ''}`}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-medium text-gray-900 text-sm">{product.name}</span>
            {isInCart && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
                <CheckCircle size={10} />
                В корзине
              </span>
            )}
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
            <span>Арт: {product.article}</span>
            <span>Маржа: {margin.toFixed(0)}%</span>
            <span className={`font-medium ${product.stock <= product.min_stock ? 'text-yellow-600' : 'text-green-600'}`}>
              Остаток: {product.stock} шт.
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs">
            <span>Себест: {formatPrice(product.cost_price)}</span>
            <span>Розница: {formatPrice(product.retail_price)}</span>
          </div>
        </div>
        
        {!isInCart ? (
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={quantity}
                onChange={handleQuantityChange}
                className="w-14 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                min={1}
                max={product.stock}
              />
              <input
                type="number"
                value={price}
                onChange={handlePriceChange}
                className="w-24 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                step="0.01"
              />
              <button
                onClick={handleAdd}
                disabled={!!quantityError || !!priceError || product.stock === 0}
                className="p-1.5 text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
              >
                <Plus size={18} />
              </button>
            </div>
            {(quantityError || priceError) && (
              <div className="text-xs text-red-500">{quantityError || priceError}</div>
            )}
          </div>
        ) : (
          <div className="text-sm text-green-600 font-medium px-3 py-2 bg-green-100 rounded-lg">
            В корзине
          </div>
        )}
      </div>
    </div>
  );
};

// Компонент строки товара в корзине
interface CartItemComponentProps {
  item: CartItem;
  onUpdateQuantity: (itemId: number, quantity: number) => void;
  onUpdatePrice: (itemId: number, price: number) => void;
  onRemove: (itemId: number) => void;
}

const CartItemComponent: React.FC<CartItemComponentProps> = ({ item, onUpdateQuantity, onUpdatePrice, onRemove }) => {
  const [quantity, setQuantity] = useState<number>(item.quantity);
  const [price, setPrice] = useState<number>(item.selling_price);
  const [quantityError, setQuantityError] = useState<string>('');
  const [priceError, setPriceError] = useState<string>('');

  const validateQuantity = (value: number): string => {
    if (isNaN(value) || value < 1) return '>0';
    if (value > item.stock) return `доступно ${item.stock}`;
    return '';
  };

  const validatePrice = (value: number): string => {
    if (isNaN(value) || value <= 0) return '>0';
    if (value < item.cost_price) return `не ниже ${formatPrice(item.cost_price)}`;
    return '';
  };

  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseInt(e.target.value);
    setQuantity(val);
    const error = validateQuantity(val);
    setQuantityError(error);
    if (!error && !isNaN(val)) {
      onUpdateQuantity(item.id, val);
    }
  };

  const handlePriceChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setPrice(val);
    const error = validatePrice(val);
    setPriceError(error);
    if (!error && !isNaN(val)) {
      onUpdatePrice(item.id, val);
    }
  };

  const total = item.selling_price * item.quantity;
  const profit = (item.selling_price - item.cost_price) * item.quantity;

  return (
    <div className="border border-gray-200 rounded-lg p-2">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-medium text-gray-900 text-sm">{item.name}</p>
          <p className="text-xs text-gray-500">Арт. {item.article}</p>
          <div className="flex items-center gap-2 mt-1">
            <span className="text-xs text-gray-500">Себест: {formatPrice(item.cost_price)}</span>
            <span className="text-xs text-green-600">Прибыль: +{formatPrice(profit)}</span>
          </div>
        </div>
        <button onClick={() => onRemove(item.id)} className="text-red-500 hover:bg-red-50 p-1 rounded">
          <Trash2 size={14} />
        </button>
      </div>
      
      <div className="flex gap-2 mt-2">
        <div className="flex-1">
          <label className="text-xs text-gray-500">Кол-во</label>
          <input
            type="number"
            value={quantity}
            onChange={handleQuantityChange}
            className="w-full px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            min={1}
            max={item.stock}
          />
          {quantityError && <p className="text-xs text-red-500 mt-0.5">{quantityError}</p>}
        </div>
        <div className="flex-1">
          <label className="text-xs text-gray-500">Цена</label>
          <input
            type="number"
            value={price}
            onChange={handlePriceChange}
            className="w-full px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
            step="0.01"
          />
          {priceError && <p className="text-xs text-red-500 mt-0.5">{priceError}</p>}
        </div>
        <div className="flex-1 text-right">
          <label className="text-xs text-gray-500">Сумма</label>
          <p className="font-semibold text-sm">{formatPrice(total)}</p>
        </div>
      </div>
    </div>
  );
};

// Основной компонент
export const NewOrder: React.FC = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  
  // Получаем clientId из URL параметра ?clientId=123 или из state
  const clientIdFromUrl = searchParams.get('clientId');
  const clientIdFromState = (location.state as { clientId?: number })?.clientId;
  const clientId = clientIdFromUrl ? parseInt(clientIdFromUrl) : clientIdFromState;
  
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [clientDiscount, setClientDiscount] = useState<number>(0); // 🆕 Скидка клиента
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [customerEmail, setCustomerEmail] = useState<string>('');
  const [customerCity, setCustomerCity] = useState<string>('');
  const [description, setDescription] = useState<string>('');
  
  const [phoneError, setPhoneError] = useState<string>('');
  
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [orderLoading, setOrderLoading] = useState<boolean>(false);
  
  const [autoCreatedClient, setAutoCreatedClient] = useState<Client | null>(null);
  
  // Фильтры
  const [filters, setFilters] = useState<FilterState>({
    search: '',
    categoryIds: [],
    priceMin: '',
    priceMax: '',
    stockStatus: 'all',
    characteristics: {}
  });

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

  const cartProductIds = useMemo(() => {
    return new Set(cartItems.map(item => item.id));
  }, [cartItems]);

  // Загрузка данных
  useEffect(() => {
    loadProducts();
    loadCategories();
  }, []);

  // Загрузка клиента если есть clientId в URL или state
  useEffect(() => {
    if (clientId) {
      loadClientById(clientId);
    }
  }, [clientId]);

  const loadProducts = async (): Promise<void> => {
    try {
      setLoading(true);
      const { data } = await productsApi.getAll();
      setProducts(data);
    } catch (error) {
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

  const loadClientById = async (id: number): Promise<void> => {
    try {
      const response = await clientsApi.getById(id);
      const client = response.data;
      setSelectedClient(client);
      const fullName = [client.lastName, client.firstName, client.middleName]
        .filter(Boolean)
        .join(' ')
        .trim() || client.firstName;
      setCustomerName(fullName);
      setCustomerPhone(client.phone);
      setCustomerEmail(client.email || '');
      setCustomerCity(client.city || '');
      setClientDiscount(client.discountPercent || 0); // 🆕 Устанавливаем скидку клиента
      setPhoneError('');
      toast.success(`Выбран клиент: ${fullName}${client.discountPercent ? ` (скидка ${client.discountPercent}%)` : ''}`);
    } catch (error) {
      console.error('Error loading client:', error);
      toast.error('Ошибка загрузки данных клиента');
    }
  };

  const handleSelectClient = (client: Client): void => {
    setSelectedClient(client);
    const fullName = [client.lastName, client.firstName, client.middleName]
      .filter(Boolean)
      .join(' ')
      .trim() || client.firstName;
    setCustomerName(fullName);
    setCustomerPhone(client.phone);
    setCustomerEmail(client.email || '');
    setCustomerCity(client.city || '');
    setClientDiscount(client.discountPercent || 0); // 🆕 Устанавливаем скидку клиента
    setAutoCreatedClient(null);
    setPhoneError('');
    toast.success(`Выбран клиент: ${fullName}${client.discountPercent ? ` (скидка ${client.discountPercent}%)` : ''}`);
  };

  const handleClearClient = (): void => {
    setSelectedClient(null);
    setAutoCreatedClient(null);
    setClientDiscount(0); // 🆕 Сбрасываем скидку клиента
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
    const rawValue = e.target.value;
    const formattedValue = formatPhone(rawValue);
    setCustomerPhone(formattedValue);
    
    const error = validatePhone(formattedValue);
    setPhoneError(error || '');
    
    if (selectedClient) setSelectedClient(null);
  };

  // Сброс фильтров
  const clearAllFilters = useCallback(() => {
    setFilters({
      search: '',
      categoryIds: [],
      priceMin: '',
      priceMax: '',
      stockStatus: 'all',
      characteristics: {}
    });
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

  // Фильтрация товаров
  const filteredProducts = useMemo(() => {
    let filtered = products.filter(p => p.stock > 0);
    
    // Поиск по тексту
    if (filters.search) {
      const searchLower = filters.search.toLowerCase();
      filtered = filtered.filter(p => 
        p.name?.toLowerCase().includes(searchLower) ||
        p.article?.toLowerCase().includes(searchLower)
      );
    }
    
    // Фильтр по категориям
    if (filters.categoryIds.length > 0) {
      filtered = filtered.filter(p => {
        const productCategoryIds = p.categories?.map(c => c.id) || p.categoryIds || [];
        return filters.categoryIds.some(catId => productCategoryIds.includes(catId));
      });
    }
    
    // Фильтр по цене
    if (filters.priceMin !== '') {
      filtered = filtered.filter(p => p.retail_price >= filters.priceMin);
    }
    if (filters.priceMax !== '') {
      filtered = filtered.filter(p => p.retail_price <= filters.priceMax);
    }
    
    // Фильтр по остатку
    if (filters.stockStatus !== 'all') {
      filtered = filtered.filter(p => {
        if (filters.stockStatus === 'low') return p.stock <= (p.min_stock || 5);
        if (filters.stockStatus === 'out') return p.stock === 0;
        if (filters.stockStatus === 'in') return p.stock > 0;
        return true;
      });
    }
    
    // Фильтр по характеристикам
    if (Object.keys(filters.characteristics).length > 0) {
      filtered = filtered.filter(p => {
        const productChars = p.characteristics || {};
        for (const [fieldId, filterValue] of Object.entries(filters.characteristics)) {
          if (!filterValue) continue;
          
          const field = availableCharacteristicFields.find(f => f.id.toString() === fieldId);
          if (!field) continue;
          
          const productValue = productChars[field.name];
          if (!productValue) return false;
          
          const productValueStr = Array.isArray(productValue) ? productValue.join(', ') : String(productValue);
          const filterValueStr = Array.isArray(filterValue) ? filterValue.join(', ') : String(filterValue);
          
          if (!productValueStr.toLowerCase().includes(filterValueStr.toLowerCase())) return false;
        }
        return true;
      });
    }
    
    return filtered;
  }, [products, filters, availableCharacteristicFields]);

  const autoCreateClient = async (): Promise<Client | null> => {
    if (!customerName || !customerPhone) return null;
    
    const phoneValidationError = validatePhone(customerPhone);
    if (phoneValidationError) {
      toast.error(phoneValidationError);
      return null;
    }
    
    if (selectedClient) return selectedClient;
    
    try {
      const cleanPhone = customerPhone.replace(/\D/g, '');
      
      const searchResponse = await clientsApi.search(cleanPhone);
      const existingClient = searchResponse.data.clients.find(
        (c: Client) => c.phone.replace(/\D/g, '') === cleanPhone
      );
      
      if (existingClient) {
        setSelectedClient(existingClient);
        const fullName = [existingClient.lastName, existingClient.firstName, existingClient.middleName]
          .filter(Boolean)
          .join(' ')
          .trim() || existingClient.firstName;
        setCustomerName(fullName);
        setCustomerPhone(existingClient.phone);
        setCustomerEmail(existingClient.email || '');
        setCustomerCity(existingClient.city || '');
        setClientDiscount(existingClient.discountPercent || 0); // 🆕 Устанавливаем скидку клиента
        setPhoneError('');
        toast.success(`Найден существующий клиент: ${fullName}${existingClient.discountPercent ? ` (скидка ${existingClient.discountPercent}%)` : ''}`);
        return existingClient;
      }
      
      const { firstName, lastName, middleName } = parseFullName(customerName);
      
      const newClientData = {
        firstName: firstName || customerName,
        lastName: lastName || '',
        middleName: middleName || '',
        phone: customerPhone,
        email: customerEmail || null,
        city: customerCity || null
      };
      
      const response = await clientsApi.create(newClientData);
      const newClient = response.data;
      
      setSelectedClient(newClient);
      setAutoCreatedClient(newClient);
      setClientDiscount(0); // 🆕 У нового клиента скидка 0
      toast.success(`Клиент "${customerName}" успешно добавлен в базу!`);
      return newClient;
      
    } catch (error) {
      console.error('Error auto creating client:', error);
      if ((error as { response?: { data?: { error?: string } } }).response?.data?.error) {
        toast.error((error as { response: { data: { error: string } } }).response.data.error);
      } else {
        toast.error('Ошибка при создании клиента');
      }
      return null;
    }
  };

  const handleCreateOrder = async (): Promise<void> => {
    if (cartItems.length === 0) {
      toast.error('Добавьте товары в заказ');
      return;
    }
    
    if (!customerName) {
      toast.error('Введите имя покупателя');
      return;
    }
    
    const phoneValidationError = validatePhone(customerPhone);
    if (phoneValidationError) {
      toast.error(phoneValidationError);
      return;
    }
    
    setOrderLoading(true);
    
    try {
      let finalClientId: number | null = selectedClient?.id || null;
      
      if (!selectedClient) {
        const newClient = await autoCreateClient();
        if (newClient) {
          finalClientId = newClient.id;
        } else {
          setOrderLoading(false);
          return;
        }
      }
      
      // Рассчитываем общую сумму для применения скидки клиента
      const subtotal = cartItems.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
      const clientDiscountAmount = subtotal * (clientDiscount / 100);
      const manualDiscount = subtotal * (discountPercent / 100);
      const totalDiscount = clientDiscountAmount + manualDiscount;
      
      const orderData = {
        documentType: 'order' as const,
        clientId: finalClientId,
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail || null,
        customerAddress: null,
        description: description || null,
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.selling_price
        })),
        discount: totalDiscount,
        paymentMethod: 'cash',
        paymentStatus: 'unpaid' as const
      };
      
      const response = await saleDocumentsApi.create(orderData);
      
      toast.success('Заказ успешно создан');
      navigate(`/sales/${response.data.document.id}`);
      
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error((error as { response?: { data?: { message?: string } } }).response?.data?.message || 'Ошибка создания заказа');
    } finally {
      setOrderLoading(false);
    }
  };

  const calculateTotals = (): Totals => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
    const clientDiscountAmount = subtotal * (clientDiscount / 100);
    const manualDiscountAmount = subtotal * (discountPercent / 100);
    const discountAmount = clientDiscountAmount + manualDiscountAmount;
    const totalWithDiscount = subtotal - discountAmount;
    const totalProfit = cartItems.reduce((sum, item) => sum + ((item.selling_price - item.cost_price) * item.quantity), 0);
    
    return { 
      subtotal, 
      discountAmount, 
      totalWithDiscount, 
      totalProfit,
      discountPercent
    };
  };

  const totals = calculateTotals();

  const addToCart = (product: Product, quantity: number, price: number): void => {
    if (quantity < 1) {
      toast.error('Количество должно быть больше 0');
      return;
    }
    
    if (quantity > product.stock) {
      toast.error(`Доступно только ${product.stock} шт.`);
      return;
    }
    
    if (price < product.cost_price) {
      toast.error(`Цена не может быть ниже себестоимости (${formatPrice(product.cost_price)})`);
      return;
    }
    
    const existingItem = cartItems.find(item => item.id === product.id);
    
    if (existingItem) {
      toast.error(
        <div className="flex flex-col gap-1">
          <div className="font-medium">Товар уже в корзине!</div>
          <div className="text-sm text-gray-600">
            "{product.name}" уже добавлен в заказ.
          </div>
          <div className="text-xs text-gray-500 mt-1">
            Вы можете изменить количество и цену прямо в корзине.
          </div>
        </div>,
        {
          duration: 4000,
          icon: <AlertCircle className="text-yellow-500" size={20} />
        }
      );
      return;
    }
    
    setCartItems([...cartItems, {
      id: product.id,
      name: product.name,
      article: product.article,
      cost_price: product.cost_price,
      selling_price: price,
      quantity: quantity,
      stock: product.stock
    }]);
    
    toast.success(`${product.name} добавлен в заказ`);
  };

  const updateCartQuantity = (itemId: number, newQuantity: number): void => {
    const item = cartItems.find(i => i.id === itemId);
    if (!item) return;
    
    if (newQuantity < 1) {
      removeFromCart(itemId);
      return;
    }
    
    if (newQuantity > item.stock) {
      toast.error(`Доступно только ${item.stock} шт.`);
      return;
    }
    
    setCartItems(cartItems.map(item =>
      item.id === itemId ? { ...item, quantity: newQuantity } : item
    ));
  };

  const updateCartPrice = (itemId: number, newPrice: number): void => {
    const item = cartItems.find(i => i.id === itemId);
    if (!item) return;
    
    if (newPrice < item.cost_price) {
      toast.error(`Цена не может быть ниже себестоимости (${formatPrice(item.cost_price)})`);
      return;
    }
    
    setCartItems(cartItems.map(item =>
      item.id === itemId ? { ...item, selling_price: newPrice } : item
    ));
  };

  const removeFromCart = (itemId: number): void => {
    setCartItems(cartItems.filter(item => item.id !== itemId));
    toast.success('Товар удален из заказа');
  };

  const hasActiveFilters = filters.search || filters.categoryIds.length > 0 || filters.priceMin !== '' || filters.priceMax !== '' || filters.stockStatus !== 'all' || Object.keys(filters.characteristics).length > 0;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center gap-4">
        <button
          onClick={() => navigate('/sales')}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
        >
          <ArrowLeft size={24} />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Новый заказ</h1>
          <p className="text-gray-500 mt-1">Создание нового заказа</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Левая колонка - каталог товаров с фильтрацией */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-gray-900">Каталог товаров</h2>
                <button
                  onClick={() => setShowFilters(!showFilters)}
                  className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
                    showFilters || hasActiveFilters
                      ? 'bg-primary-50 text-primary-600'
                      : 'text-gray-500 hover:bg-gray-100'
                  }`}
                >
                  <SlidersHorizontal size={16} />
                  Фильтры
                  {hasActiveFilters && !showFilters && (
                    <span className="w-2 h-2 bg-primary-500 rounded-full"></span>
                  )}
                </button>
              </div>
              
              {/* Поисковая строка */}
              <div className="relative mt-3">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Поиск по названию или артикулу..."
                  value={filters.search}
                  onChange={(e) => setFilters(prev => ({ ...prev, search: e.target.value }))}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              
              {/* Панель фильтров */}
              {showFilters && (
                <div className="mt-4 pt-4 border-t border-gray-100 space-y-4">
                  {/* Категории */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <Tag size={14} />
                      Категории
                    </label>
                    <CategoryMultiSelect
                      categories={categories}
                      selectedIds={filters.categoryIds}
                      onChange={(ids) => setFilters(prev => ({ ...prev, categoryIds: ids }))}
                    />
                  </div>
                  
                  {/* Цена */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <DollarSign size={14} />
                      Цена
                    </label>
                    <div className="flex gap-2">
                      <input
                        type="number"
                        placeholder="от"
                        value={filters.priceMin === '' ? '' : filters.priceMin}
                        onChange={(e) => setFilters(prev => ({ ...prev, priceMin: e.target.value === '' ? '' : Number(e.target.value) }))}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                      <input
                        type="number"
                        placeholder="до"
                        value={filters.priceMax === '' ? '' : filters.priceMax}
                        onChange={(e) => setFilters(prev => ({ ...prev, priceMax: e.target.value === '' ? '' : Number(e.target.value) }))}
                        className="w-full px-3 py-1.5 text-sm rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                      />
                    </div>
                  </div>
                  
                  {/* Остаток */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1.5 flex items-center gap-2">
                      <Boxes size={14} />
                      Остаток
                    </label>
                    <div className="flex flex-wrap gap-2">
                      {[
                        { value: 'all', label: 'Все', color: 'gray' },
                        { value: 'in', label: 'В наличии', color: 'green' },
                        { value: 'low', label: 'Низкий', color: 'yellow' },
                        { value: 'out', label: 'Нет', color: 'red' }
                      ].map(option => (
                        <button
                          key={option.value}
                          onClick={() => setFilters(prev => ({ ...prev, stockStatus: option.value as any }))}
                          className={`px-2 py-1 text-xs rounded-full transition-colors ${
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
                  
                  {/* Характеристики */}
                  {availableCharacteristicFields.length > 0 && (
                    <CharacteristicFilter
                      fields={availableCharacteristicFields}
                      values={filters.characteristics}
                      onChange={handleCharacteristicFilterChange}
                      onClear={(fieldId) => {
                        setFilters(prev => {
                          const newChars = { ...prev.characteristics };
                          delete newChars[fieldId];
                          return { ...prev, characteristics: newChars };
                        });
                      }}
                    />
                  )}
                  
                  {/* Активные фильтры */}
                  {hasActiveFilters && (
                    <div className="flex flex-wrap gap-1 pt-2">
                      {filters.categoryIds.map(id => {
                        const cat = categories.find(c => c.id === id);
                        return cat && (
                          <span key={id} className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-primary-100 text-primary-700 rounded-full">
                            {cat.name}
                            <button onClick={() => setFilters(prev => ({ ...prev, categoryIds: prev.categoryIds.filter(i => i !== id) }))}>
                              <X size={10} />
                            </button>
                          </span>
                        );
                      })}
                      {(filters.priceMin !== '' || filters.priceMax !== '') && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-blue-100 text-blue-700 rounded-full">
                          {filters.priceMin || '0'} - {filters.priceMax || '∞'} ₽
                          <button onClick={() => setFilters(prev => ({ ...prev, priceMin: '', priceMax: '' }))}>
                            <X size={10} />
                          </button>
                        </span>
                      )}
                      {filters.stockStatus !== 'all' && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-yellow-100 text-yellow-700 rounded-full">
                          {filters.stockStatus === 'in' && 'В наличии'}
                          {filters.stockStatus === 'low' && 'Низкий остаток'}
                          {filters.stockStatus === 'out' && 'Нет в наличии'}
                          <button onClick={() => setFilters(prev => ({ ...prev, stockStatus: 'all' }))}>
                            <X size={10} />
                          </button>
                        </span>
                      )}
                      {hasActiveFilters && (
                        <button
                          onClick={clearAllFilters}
                          className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-gray-100 text-gray-600 rounded-full hover:bg-gray-200"
                        >
                          <RefreshCw size={10} />
                          Сбросить всё
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* Список товаров */}
            <div className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {loading ? (
                <div className="text-center py-8 text-gray-500">Загрузка...</div>
              ) : filteredProducts.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <Package size={32} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Товары не найдены</p>
                  {hasActiveFilters && (
                    <button
                      onClick={clearAllFilters}
                      className="mt-2 text-xs text-primary-600 hover:underline"
                    >
                      Сбросить фильтры
                    </button>
                  )}
                </div>
              ) : (
                filteredProducts.map(product => (
                  <ProductRow
                    key={product.id}
                    product={product}
                    isInCart={cartProductIds.has(product.id)}
                    onAddToCart={addToCart}
                  />
                ))
              )}
            </div>
            
            {/* Счетчик результатов */}
            {!loading && filteredProducts.length > 0 && (
              <div className="p-3 border-t border-gray-100 text-center text-xs text-gray-400">
                Найдено товаров: {filteredProducts.length}
              </div>
            )}
          </div>
        </div>

        {/* Правая колонка - корзина и данные клиента */}
        <div className="space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sticky top-4">
            <h2 className="text-lg font-semibold text-gray-900 mb-4 flex items-center gap-2">
              <ShoppingCart size={20} />
              Корзина ({cartItems.reduce((sum, i) => sum + i.quantity, 0)} шт.)
            </h2>

            <div className="max-h-80 overflow-y-auto mb-4 space-y-3">
              {cartItems.length === 0 ? (
                <div className="text-center py-8 text-gray-500">
                  <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
                  <p className="text-sm">Корзина пуста</p>
                  <p className="text-xs text-gray-400 mt-1">Добавьте товары из каталога</p>
                </div>
              ) : (
                cartItems.map(item => (
                  <CartItemComponent
                    key={item.id}
                    item={item}
                    onUpdateQuantity={updateCartQuantity}
                    onUpdatePrice={updateCartPrice}
                    onRemove={removeFromCart}
                  />
                ))
              )}
            </div>

            {cartItems.length > 0 && (
              <div className="border-t pt-3 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Сумма:</span>
                  <span className="font-medium">{formatPrice(totals.subtotal)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Прибыль:</span>
                  <span className="font-medium text-green-600">{formatPrice(totals.totalProfit)}</span>
                </div>
                
                {/* 🆕 Отображение скидки клиента */}
                {clientDiscount > 0 && (
                  <div className="flex justify-between text-sm text-green-600 bg-green-50 p-2 rounded-lg">
                    <span className="flex items-center gap-1">
                      <Percent size={14} />
                      Скидка клиента ({clientDiscount}%):
                    </span>
                    <span className="font-medium">-{formatPrice(totals.subtotal * (clientDiscount / 100))}</span>
                  </div>
                )}
                
                <div className="flex justify-between items-center">
                  <div className="flex items-center gap-2">
                    <Percent size={14} className="text-gray-400" />
                    <span className="text-gray-600 text-sm">Доп. скидка:</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={discountPercent}
                      onChange={(e) => {
                        const val = parseFloat(e.target.value);
                        setDiscountPercent(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
                      }}
                      className="w-16 px-2 py-1 text-right rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                      step="1"
                      min={0}
                      max={100}
                    />
                    <span className="text-gray-600 text-sm">%</span>
                    <span className="text-gray-600 text-sm">(-{formatPrice(totals.subtotal * (discountPercent / 100))})</span>
                  </div>
                </div>
                
                <div className="flex justify-between text-lg font-bold pt-2 border-t">
                  <span>Итого:</span>
                  <span className="text-primary-600">{formatPrice(totals.totalWithDiscount)}</span>
                </div>
              </div>
            )}

            {/* Поиск клиента */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-2 text-sm">
                <Users size={14} />
                Клиент
              </h3>
              <ClientSearch
                selectedClient={selectedClient}
                onSelect={handleSelectClient}
                onClear={handleClearClient}
              />
            </div>

            {/* Данные покупателя */}
            <div className="space-y-2 mt-4">
              <h3 className="font-medium text-gray-900 text-sm">Данные покупателя</h3>
              
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Имя покупателя *"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (selectedClient) setSelectedClient(null);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                  required
                />
              </div>
              
              <div className="relative">
                <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="tel"
                  placeholder="Телефон *"
                  value={customerPhone}
                  onChange={handlePhoneChange}
                  className={`w-full pl-8 pr-3 py-1.5 rounded-lg border ${
                    phoneError ? 'border-red-500' : 'border-gray-200'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm`}
                  required
                />
              </div>
              {phoneError && (
                <p className="text-xs text-red-500">{phoneError}</p>
              )}
              
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="email"
                  placeholder="Email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={14} />
                <input
                  type="text"
                  placeholder="Город"
                  value={customerCity}
                  onChange={(e) => {
                    setCustomerCity(e.target.value);
                    if (selectedClient) setSelectedClient(null);
                  }}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>

              {/* Комментарий к заказу */}
              <div className="relative">
                <AlignLeft className="absolute left-3 top-2.5 text-gray-400" size={14} />
                <textarea
                  placeholder="Комментарий к заказу"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={2}
                  className="w-full pl-8 pr-3 py-1.5 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm resize-none"
                />
              </div>
            </div>

            {/* Кнопка создания */}
            <Button
              onClick={handleCreateOrder}
              disabled={cartItems.length === 0 || orderLoading || !customerName || !customerPhone || !!phoneError}
              fullWidth
              icon={Save}
              className="mt-4"
              size="lg"
            >
              {orderLoading ? 'Создание...' : 'Создать заказ'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default NewOrder;