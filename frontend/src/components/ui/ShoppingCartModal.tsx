// frontend/src/components/ui/ShoppingCartModal.tsx
import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react';
import { productsApi } from '../../api/products';
import { categoriesApi } from '../../api/categories';
import { saleDocumentsApi } from '../../api/saleDocuments';
import { Button } from './Button';
import { Input } from './Input';
import { Modal } from './Modal';
import { formatPrice } from '../../utils/formatters';
import { 
  Plus, 
  Minus, 
  Trash2, 
  ShoppingCart, 
  Search, 
  Filter,
  X,
  Package,
  User,
  Phone,
  CreditCard,
  CheckCircle,
  Percent
} from 'lucide-react';
import toast from 'react-hot-toast';

// Типы
interface ProductCharacteristic {
  [key: string]: string | string[];
}

interface Product {
  id: number;
  name: string;
  article: string;
  cost_price: number;
  retail_price: number;
  stock: number;
  min_stock: number;
  description?: string;
  categoryId?: number;
  characteristics?: ProductCharacteristic;
  productCategory?: {
    name: string;
  };
}

interface Category {
  id: number;
  name: string;
  description?: string;
}

interface CartItem {
  id: number;
  name: string;
  article: string;
  cost_price: number;
  selling_price: number;
  quantity: number;
  stock: number;
  characteristics?: ProductCharacteristic;
}

interface OrderTotals {
  subtotal: number;
  totalCost: number;
  totalProfit: number;
  discountAmount: number;
  totalWithDiscount: number;
}

interface CurrentOrder {
  id: number;
  number: string;
  items: CartItem[];
  customer: {
    name: string;
    phone: string;
  };
  totals: OrderTotals;
  discountPercent: number;
}

interface ShoppingCartModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

type Step = 'catalog' | 'checkout' | 'success';

// Хук для debounce
function useDebounce<T>(value: T, delay: number = 300): T {
  const [debouncedValue, setDebouncedValue] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedValue(value);
    }, delay);

    return () => {
      clearTimeout(timer);
    };
  }, [value, delay]);

  return debouncedValue;
}

export const ShoppingCartModal: React.FC<ShoppingCartModalProps> = ({ 
  isOpen, 
  onClose, 
  onSuccess 
}) => {
  // Состояния для товаров и категорий
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  
  // Поиск и фильтры
  const [searchTerm, setSearchTerm] = useState<string>('');
  const debouncedSearchTerm = useDebounce(searchTerm, 300); // Задержка 300ms
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState<string>('');
  const [showFilters, setShowFilters] = useState<boolean>(false);
  
  // Корзина и заказ
  const [cartItems, setCartItems] = useState<CartItem[]>([]);
  const [customerName, setCustomerName] = useState<string>('');
  const [customerPhone, setCustomerPhone] = useState<string>('');
  const [discountPercent, setDiscountPercent] = useState<number>(0);
  const [step, setStep] = useState<Step>('catalog');
  const [currentOrder, setCurrentOrder] = useState<CurrentOrder | null>(null);
  
  // Состояние для выбранного товара при добавлении в корзину
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [selectedQuantity, setSelectedQuantity] = useState<number>(1);
  const [selectedPrice, setSelectedPrice] = useState<number>(0);
  const [priceError, setPriceError] = useState<string>('');
  const [quantityError, setQuantityError] = useState<string>('');

  // Загрузка данных при открытии модалки
  useEffect(() => {
    if (isOpen) {
      loadProducts();
      loadCategories();
    }
  }, [isOpen]);

  // Обновляем цену при выборе товара
  useEffect(() => {
    if (selectedProduct) {
      setSelectedPrice(selectedProduct.retail_price);
      setPriceError('');
    }
  }, [selectedProduct]);

  const loadProducts = async (): Promise<void> => {
    try {
      const { data } = await productsApi.getAll();
      setProducts(data);
    } catch (error) {
      toast.error('Ошибка загрузки товаров');
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

  // Валидация количества
  const validateQuantity = (quantity: number, product: Product | null): string => {
    if (!product) return 'Выберите товар';
    if (quantity < 1) return 'Количество должно быть больше 0';
    if (quantity > product.stock) return `Доступно только ${product.stock} шт.`;
    return '';
  };

  // Валидация цены
  const validatePrice = (price: number, product: Product | null): string => {
    if (!product) return 'Выберите товар';
    if (price <= 0) return 'Цена должна быть больше 0';
    if (price < product.cost_price) {
      return `Цена не может быть ниже себестоимости (${formatPrice(product.cost_price)})`;
    }
    return '';
  };

  // Фильтрация товаров - оптимизирована с useCallback и useMemo
  const filterProducts = useCallback((product: Product): boolean => {
    const searchLower = debouncedSearchTerm.toLowerCase().trim();
    
    if (!searchLower) return true;
    
    if (product.name?.toLowerCase().includes(searchLower)) return true;
    if (product.article?.toLowerCase().includes(searchLower)) return true;
    if (product.productCategory?.name?.toLowerCase().includes(searchLower)) return true;
    
    if (product.characteristics) {
      for (const [_, value] of Object.entries(product.characteristics)) {
        const stringValue = Array.isArray(value) ? value.join(' ') : String(value);
        if (stringValue.toLowerCase().includes(searchLower)) return true;
      }
    }
    
    return false;
  }, [debouncedSearchTerm]);

  const filterByCategory = useCallback((product: Product): boolean => {
    if (!selectedCategoryFilter) return true;
    return product.categoryId === parseInt(selectedCategoryFilter);
  }, [selectedCategoryFilter]);

  // Оптимизированный список товаров с useMemo
  const filteredProducts = useMemo(() => {
    return products
      .filter(filterProducts)
      .filter(filterByCategory)
      .filter(product => product.stock > 0);
  }, [products, filterProducts, filterByCategory]);

  // Оптимизированный список популярных товаров (первые 5)
  const popularProducts = useMemo(() => {
    return filteredProducts.slice(0, 5);
  }, [filteredProducts]);

  // Добавление товара в корзину
  const addToCart = useCallback((): void => {
    if (!selectedProduct) {
      toast.error('Выберите товар');
      return;
    }
    
    const qtyError = validateQuantity(selectedQuantity, selectedProduct);
    const prcError = validatePrice(selectedPrice, selectedProduct);
    
    if (qtyError) {
      toast.error(qtyError);
      return;
    }
    
    if (prcError) {
      toast.error(prcError);
      return;
    }
    
    setCartItems(prevItems => {
      const existingItem = prevItems.find(item => item.id === selectedProduct.id);
      
      if (existingItem) {
        const newQuantity = existingItem.quantity + selectedQuantity;
        if (newQuantity > selectedProduct.stock) {
          toast.error(`Всего доступно ${selectedProduct.stock} шт.`);
          return prevItems;
        }
        return prevItems.map(item =>
          item.id === selectedProduct.id
            ? { ...item, quantity: newQuantity, selling_price: selectedPrice }
            : item
        );
      } else {
        return [...prevItems, {
          id: selectedProduct.id,
          name: selectedProduct.name,
          article: selectedProduct.article,
          cost_price: selectedProduct.cost_price,
          selling_price: selectedPrice,
          quantity: selectedQuantity,
          stock: selectedProduct.stock,
          characteristics: selectedProduct.characteristics
        }];
      }
    });
    
    // Сбрасываем выбор
    setSelectedProduct(null);
    setSelectedQuantity(1);
    setSelectedPrice(0);
    setPriceError('');
    setQuantityError('');
    
    toast.success('Товар добавлен в корзину');
  }, [selectedProduct, selectedQuantity, selectedPrice]);

  // Обновление количества товара в корзине
  const updateQuantity = useCallback((itemId: number, newQuantity: number): void => {
    setCartItems(prevItems => {
      const item = prevItems.find(i => i.id === itemId);
      if (!item) return prevItems;
      
      if (newQuantity < 1) {
        return prevItems.filter(i => i.id !== itemId);
      }
      
      if (newQuantity > item.stock) {
        toast.error(`Доступно только ${item.stock} шт.`);
        return prevItems;
      }
      
      return prevItems.map(item =>
        item.id === itemId
          ? { ...item, quantity: newQuantity }
          : item
      );
    });
  }, []);

  // Обновление цены товара в корзине
  const updatePrice = useCallback((itemId: number, newPrice: number): void => {
    setCartItems(prevItems => {
      const item = prevItems.find(i => i.id === itemId);
      if (!item) return prevItems;
      
      if (newPrice < item.cost_price) {
        toast.error(`Цена не может быть ниже себестоимости (${formatPrice(item.cost_price)})`);
        return prevItems;
      }
      
      if (newPrice <= 0) {
        toast.error('Цена должна быть больше 0');
        return prevItems;
      }
      
      return prevItems.map(item =>
        item.id === itemId
          ? { ...item, selling_price: newPrice }
          : item
      );
    });
  }, []);

  // Удаление товара из корзины
  const removeFromCart = useCallback((itemId: number): void => {
    setCartItems(prev => prev.filter(item => item.id !== itemId));
    toast.success('Товар удален из корзины');
  }, []);

  // Расчет итогов - оптимизирован с useMemo
  const totals = useMemo((): OrderTotals => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
    const totalCost = cartItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
    const totalProfit = subtotal - totalCost;
    const discountAmount = subtotal * (discountPercent / 100);
    const totalWithDiscount = subtotal - discountAmount;
    
    return { subtotal, totalCost, totalProfit, discountAmount, totalWithDiscount };
  }, [cartItems, discountPercent]);

  // Оформление заказа
  const handleCheckout = async (): Promise<void> => {
    if (cartItems.length === 0) {
      toast.error('Корзина пуста');
      return;
    }
    
    if (!customerName) {
      toast.error('Введите имя покупателя');
      return;
    }
    
    if (!customerPhone) {
      toast.error('Введите телефон покупателя');
      return;
    }
    
    setLoading(true);
    
    try {
      const orderData = {
        documentType: 'order',
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: null,
        customerAddress: null,
        items: cartItems.map(item => ({
          productId: item.id,
          quantity: item.quantity,
          price: item.selling_price
        })),
        discount: totals.discountAmount,
        paymentMethod: 'cash',
        paymentStatus: 'unpaid'
      };
      
      const response = await saleDocumentsApi.create(orderData);
      
      setCurrentOrder({
        id: response.data.document.id,
        number: response.data.document.documentNumber,
        items: cartItems,
        customer: { name: customerName, phone: customerPhone },
        totals,
        discountPercent
      });
      
      setStep('success');
      
      // Очищаем корзину
      setCartItems([]);
      setCustomerName('');
      setCustomerPhone('');
      setDiscountPercent(0);
      
      if (onSuccess) onSuccess();
      
      toast.success('Заказ успешно создан!');
      
    } catch (error: any) {
      console.error('Error creating order:', error);
      toast.error(error.response?.data?.message || 'Ошибка оформления заказа');
    } finally {
      setLoading(false);
    }
  };

  // Сброс состояния при закрытии
  const handleClose = useCallback((): void => {
    setStep('catalog');
    setCartItems([]);
    setCustomerName('');
    setCustomerPhone('');
    setDiscountPercent(0);
    setSelectedProduct(null);
    setSelectedQuantity(1);
    setSearchTerm('');
    setSelectedCategoryFilter('');
    onClose();
  }, [onClose]);

  // Форматирование телефона (для валидации)
  const formatPhone = useCallback((value: string): string => {
    const digits = value.replace(/\D/g, '');
    if (digits.length === 0) return '';
    if (digits.length <= 1) return `+7 (${digits}`;
    if (digits.length <= 4) return `+7 (${digits.slice(1, 4)}`;
    if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}`;
    if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}`;
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }, []);

  // Обработчик изменения поиска
  const handleSearchChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchTerm(e.target.value);
  }, []);

  // Рендер каталога товаров
  const renderCatalog = useMemo(() => (
    <div className="space-y-4">
      {/* Поиск и фильтры */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по названию, артикулу..."
            value={searchTerm}
            onChange={handleSearchChange}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400 hover:text-primary-600"
        >
          <Filter size={14} />
          {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
        </button>
        
        {showFilters && (
          <div className="pt-2">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
            >
              <option value="">Все категории</option>
              {categories.map(category => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </div>
        )}
      </div>

      {/* Выбор товара */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 dark:text-white mb-3">Добавить товар</h4>
        <select
          value={selectedProduct?.id || ''}
          onChange={(e) => {
            const product = products.find(p => p.id === parseInt(e.target.value));
            setSelectedProduct(product || null);
            setPriceError('');
            setQuantityError('');
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
        >
          <option value="">Выберите товар</option>
          {filteredProducts.map(product => (
            <option key={product.id} value={product.id}>
              {product.name} - {formatPrice(product.retail_price)} (в наличии: {product.stock} шт.)
            </option>
          ))}
        </select>
        
        {selectedProduct && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Количество</label>
              <input
                type="number"
                value={selectedQuantity}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  setSelectedQuantity(val || 1);
                  setQuantityError(validateQuantity(val || 1, selectedProduct));
                }}
                min="1"
                max={selectedProduct.stock}
                className={`w-full px-3 py-2 rounded-lg border ${
                  quantityError ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                } focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white`}
              />
              {quantityError && <p className="text-xs text-red-500 mt-1">{quantityError}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 dark:text-gray-400 mb-1">Цена (₽)</label>
              <input
                type="number"
                value={selectedPrice}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setSelectedPrice(val);
                  setPriceError(validatePrice(val, selectedProduct));
                }}
                step="0.01"
                className={`w-full px-3 py-2 rounded-lg border ${
                  priceError ? 'border-red-500' : 'border-gray-200 dark:border-gray-700'
                } focus:outline-none focus:ring-2 focus:ring-primary-500 dark:bg-gray-800 dark:text-white`}
              />
              {priceError && <p className="text-xs text-red-500 mt-1">{priceError}</p>}
            </div>
          </div>
        )}
        
        <Button
          onClick={addToCart}
          disabled={!selectedProduct || !!quantityError || !!priceError}
          fullWidth
          className="mt-3"
          size="sm"
        >
          <Plus size={16} className="mr-1" />
          Добавить в корзину
        </Button>
      </div>

      {/* Список товаров в каталоге */}
      <div className="max-h-80 overflow-y-auto space-y-2">
        {popularProducts.map(product => {
          const margin = ((product.retail_price - product.cost_price) / product.cost_price) * 100;
          return (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedProduct?.id === product.id
                  ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-primary-300 hover:bg-gray-50 dark:hover:bg-gray-800'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 dark:text-white text-sm">{product.name}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">{product.article}</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">Маржа: {margin.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-600 dark:text-primary-400 text-sm">{formatPrice(product.retail_price)}</p>
                  <p className="text-xs text-gray-500 dark:text-gray-400">В наличии: {product.stock} шт.</p>
                </div>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            <p>Товары не найдены</p>
          </div>
        )}
      </div>
    </div>
  ), [searchTerm, handleSearchChange, showFilters, selectedCategoryFilter, categories, selectedProduct, selectedQuantity, quantityError, selectedPrice, priceError, addToCart, popularProducts, filteredProducts.length, products]);

  // Рендер корзины и оформления
  const renderCheckout = useMemo(() => (
    <div className="space-y-4">
      {/* Корзина */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900 dark:text-white flex items-center gap-2">
          <ShoppingCart size={18} />
          Корзина ({cartItems.reduce((sum, i) => sum + i.quantity, 0)} шт.)
        </h4>
        
        {cartItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <Package size={48} className="mx-auto mb-2 opacity-50" />
            <p>Корзина пуста</p>
            <button
              onClick={() => setStep('catalog')}
              className="text-primary-600 text-sm mt-2 hover:underline"
            >
              Добавить товары
            </button>
          </div>
        ) : (
          <div className="space-y-2 max-h-64 overflow-y-auto">
            {cartItems.map(item => {
              const profit = (item.selling_price - item.cost_price) * item.quantity;
              return (
                <div key={item.id} className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 dark:text-white text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500 dark:text-gray-400">Арт. {item.article}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500 dark:text-gray-400">Себест: {formatPrice(item.cost_price)}</span>
                        <span className="text-xs text-green-600 dark:text-green-400">Прибыль: +{formatPrice(profit)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-red-500 hover:bg-red-50 dark:hover:bg-red-900/30 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Кол-во</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                          className="w-12 text-center text-sm border dark:border-gray-600 rounded py-1 bg-white dark:bg-gray-700 dark:text-white"
                          min="1"
                          max={item.stock}
                        />
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center bg-white dark:bg-gray-700 border dark:border-gray-600 rounded hover:bg-gray-100 dark:hover:bg-gray-600"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Цена (₽)</label>
                      <input
                        type="number"
                        value={item.selling_price}
                        onChange={(e) => updatePrice(item.id, parseFloat(e.target.value))}
                        className="w-full px-2 py-1 text-sm border dark:border-gray-600 rounded focus:outline-none focus:ring-2 focus:ring-primary-500 bg-white dark:bg-gray-700 dark:text-white"
                        step="0.01"
                      />
                    </div>
                    <div className="flex-1 text-right">
                      <label className="text-xs text-gray-500 dark:text-gray-400">Сумма</label>
                      <p className="font-semibold text-sm dark:text-white">{formatPrice(item.selling_price * item.quantity)}</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Итоги */}
      {cartItems.length > 0 && (
        <div className="border-t dark:border-gray-700 pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600 dark:text-gray-400">Сумма:</span>
            <span className="font-medium dark:text-white">{formatPrice(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-600 dark:text-green-400">
            <span>Прибыль:</span>
            <span className="font-medium">{formatPrice(totals.totalProfit)}</span>
          </div>
          
          {/* Скидка в процентах */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Percent size={14} className="text-gray-400" />
              <span className="text-gray-600 dark:text-gray-400 text-sm">Скидка:</span>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                value={discountPercent}
                onChange={(e) => {
                  const val = parseFloat(e.target.value);
                  setDiscountPercent(isNaN(val) ? 0 : Math.min(100, Math.max(0, val)));
                }}
                className="w-16 px-2 py-1 text-right rounded border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                step="1"
                min="0"
                max="100"
              />
              <span className="text-gray-600 dark:text-gray-400 text-sm">%</span>
              <span className="text-gray-600 dark:text-gray-400 text-sm">(-{formatPrice(totals.discountAmount)})</span>
            </div>
          </div>
          
          <div className="flex justify-between text-lg font-bold pt-2 border-t dark:border-gray-700">
            <span className="dark:text-white">Итого:</span>
            <span className="text-primary-600 dark:text-primary-400">{formatPrice(totals.totalWithDiscount)}</span>
          </div>
        </div>
      )}

      {/* Данные покупателя */}
      <div className="border-t dark:border-gray-700 pt-4 space-y-3">
        <h4 className="font-medium text-gray-900 dark:text-white">Данные покупателя</h4>
        <div className="space-y-2">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Имя покупателя *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              required
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="tel"
              placeholder="Телефон *"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(formatPhone(e.target.value))}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 dark:border-gray-700 dark:bg-gray-800 dark:text-white focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              required
            />
          </div>
        </div>
      </div>

      {/* Кнопки действий */}
      <div className="flex gap-3 pt-4">
        <Button
          onClick={handleCheckout}
          disabled={cartItems.length === 0 || loading || !customerName || !customerPhone}
          fullWidth
          icon={CreditCard}
        >
          {loading ? 'Оформление...' : 'Оформить заказ'}
        </Button>
        <Button
          onClick={() => setStep('catalog')}
          variant="secondary"
          fullWidth
        >
          Назад к товарам
        </Button>
      </div>
    </div>
  ), [cartItems, totals, discountPercent, customerName, customerPhone, loading, handleCheckout, formatPhone, removeFromCart, updateQuantity, updatePrice]);

  // Рендер успешного оформления
  const renderSuccess = useMemo(() => (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-green-100 dark:bg-green-900/30 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-green-600 dark:text-green-400" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-2">Заказ оформлен!</h3>
      <p className="text-gray-500 dark:text-gray-400 mb-4">
        Спасибо за покупку! Заказ успешно создан.
      </p>
      {currentOrder && (
        <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 mb-4 text-left">
          <p className="text-sm font-medium text-gray-900 dark:text-white mb-2">Детали заказа:</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Номер: {currentOrder.number}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Товаров: {currentOrder.items.length} шт.</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Сумма: {formatPrice(currentOrder.totals.subtotal)}</p>
          {currentOrder.discountPercent > 0 && (
            <p className="text-sm text-gray-600 dark:text-gray-400">Скидка: {currentOrder.discountPercent}%</p>
          )}
          <p className="text-sm font-semibold text-primary-600 dark:text-primary-400">
            Итого: {formatPrice(currentOrder.totals.totalWithDiscount)}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">Покупатель: {currentOrder.customer.name}</p>
          <p className="text-sm text-gray-600 dark:text-gray-400">Телефон: {currentOrder.customer.phone}</p>
        </div>
      )}
      <Button onClick={handleClose} fullWidth>
        Закрыть
      </Button>
    </div>
  ), [currentOrder, handleClose]);

  const cartTotalCount = useMemo(() => cartItems.reduce((sum, i) => sum + i.quantity, 0), [cartItems]);
  const cartTotalSum = useMemo(() => totals.subtotal, [totals.subtotal]);

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'catalog' ? 'Новый заказ' : step === 'checkout' ? 'Оформление заказа' : 'Заказ оформлен'}
      size="lg"
    >
      {step === 'catalog' && renderCatalog}
      {step === 'checkout' && renderCheckout}
      {step === 'success' && renderSuccess}
      
      {/* Кнопка перехода к корзине */}
      {step === 'catalog' && cartItems.length > 0 && (
        <div className="mt-4 pt-4 border-t dark:border-gray-700">
          <button
            onClick={() => setStep('checkout')}
            className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} />
            Перейти к оформлению ({cartTotalCount} товаров на {formatPrice(cartTotalSum)})
          </button>
        </div>
      )}
    </Modal>
  );
};

export default ShoppingCartModal;