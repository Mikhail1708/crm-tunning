// frontend/src/components/ShoppingCartModal.jsx
import React, { useState, useEffect } from 'react';
import { productsApi } from '../api/products';
import { categoriesApi } from '../api/categories';
import { saleDocumentsApi } from '../api/saleDocuments';
import { Button } from './ui/Button';
import { Input } from './ui/Input';
import { Modal } from './ui/Modal';
import { formatPrice } from '../utils/formatters';
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

export const ShoppingCartModal = ({ isOpen, onClose, onSuccess }) => {
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('');
  const [showFilters, setShowFilters] = useState(false);
  const [cartItems, setCartItems] = useState([]);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [step, setStep] = useState('catalog'); // catalog, checkout, success
  const [currentOrder, setCurrentOrder] = useState(null);
  
  // Состояние для выбранного товара при добавлении в корзину
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [selectedQuantity, setSelectedQuantity] = useState(1);
  const [selectedPrice, setSelectedPrice] = useState(0);
  const [priceError, setPriceError] = useState('');
  const [quantityError, setQuantityError] = useState('');

  useEffect(() => {
    if (isOpen) {
      loadProducts();
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    // Обновляем цену при выборе товара
    if (selectedProduct) {
      setSelectedPrice(selectedProduct.retail_price);
      setPriceError('');
    }
  }, [selectedProduct]);

  const loadProducts = async () => {
    try {
      const { data } = await productsApi.getAll();
      setProducts(data);
    } catch (error) {
      toast.error('Ошибка загрузки товаров');
    }
  };

  const loadCategories = async () => {
    try {
      const { data } = await categoriesApi.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  // Валидация количества
  const validateQuantity = (quantity, product) => {
    if (!product) return 'Выберите товар';
    if (quantity < 1) return 'Количество должно быть больше 0';
    if (quantity > product.stock) return `Доступно только ${product.stock} шт.`;
    return '';
  };

  // Валидация цены
  const validatePrice = (price, product) => {
    if (!product) return 'Выберите товар';
    if (price <= 0) return 'Цена должна быть больше 0';
    if (price < product.cost_price) {
      return `Цена не может быть ниже себестоимости (${formatPrice(product.cost_price)})`;
    }
    return '';
  };

  // Фильтрация товаров
  const filterProducts = (product) => {
    const searchLower = searchTerm.toLowerCase().trim();
    
    if (!searchLower) return true;
    
    if (product.name?.toLowerCase().includes(searchLower)) return true;
    if (product.article?.toLowerCase().includes(searchLower)) return true;
    if (product.productCategory?.name?.toLowerCase().includes(searchLower)) return true;
    
    if (product.characteristics) {
      for (const [key, value] of Object.entries(product.characteristics)) {
        const stringValue = Array.isArray(value) ? value.join(' ') : String(value);
        if (stringValue.toLowerCase().includes(searchLower)) return true;
      }
    }
    
    return false;
  };

  const filterByCategory = (product) => {
    if (!selectedCategoryFilter) return true;
    return product.categoryId === parseInt(selectedCategoryFilter);
  };

  const filteredProducts = products
    .filter(filterProducts)
    .filter(filterByCategory)
    .filter(product => product.stock > 0);

  // Добавление товара в корзину
  const addToCart = () => {
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
    
    const existingItem = cartItems.find(item => item.id === selectedProduct.id);
    
    if (existingItem) {
      const newQuantity = existingItem.quantity + selectedQuantity;
      if (newQuantity > selectedProduct.stock) {
        toast.error(`Всего доступно ${selectedProduct.stock} шт.`);
        return;
      }
      setCartItems(cartItems.map(item =>
        item.id === selectedProduct.id
          ? { ...item, quantity: newQuantity, selling_price: selectedPrice }
          : item
      ));
    } else {
      setCartItems([...cartItems, {
        id: selectedProduct.id,
        name: selectedProduct.name,
        article: selectedProduct.article,
        cost_price: selectedProduct.cost_price,
        selling_price: selectedPrice,
        quantity: selectedQuantity,
        stock: selectedProduct.stock,
        characteristics: selectedProduct.characteristics
      }]);
    }
    
    // Сбрасываем выбор
    setSelectedProduct(null);
    setSelectedQuantity(1);
    setSelectedPrice(0);
    setPriceError('');
    setQuantityError('');
    
    toast.success('Товар добавлен в корзину');
  };

  // Обновление количества товара в корзине
  const updateQuantity = (itemId, newQuantity) => {
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
      item.id === itemId
        ? { ...item, quantity: newQuantity }
        : item
    ));
  };

  // Обновление цены товара в корзине
  const updatePrice = (itemId, newPrice) => {
    const item = cartItems.find(i => i.id === itemId);
    if (!item) return;
    
    if (newPrice < item.cost_price) {
      toast.error(`Цена не может быть ниже себестоимости (${formatPrice(item.cost_price)})`);
      return;
    }
    
    if (newPrice <= 0) {
      toast.error('Цена должна быть больше 0');
      return;
    }
    
    setCartItems(cartItems.map(item =>
      item.id === itemId
        ? { ...item, selling_price: newPrice }
        : item
    ));
  };

  // Удаление товара из корзины
  const removeFromCart = (itemId) => {
    setCartItems(cartItems.filter(item => item.id !== itemId));
    toast.success('Товар удален из корзины');
  };

  // Расчет итогов
  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
    const totalCost = cartItems.reduce((sum, item) => sum + (item.cost_price * item.quantity), 0);
    const totalProfit = subtotal - totalCost;
    const discountAmount = subtotal * (discountPercent / 100);
    const totalWithDiscount = subtotal - discountAmount;
    
    return { subtotal, totalCost, totalProfit, discountAmount, totalWithDiscount };
  };

  const totals = calculateTotals();

  // Оформление заказа
  const handleCheckout = async () => {
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
      
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(error.response?.data?.message || 'Ошибка оформления заказа');
    } finally {
      setLoading(false);
    }
  };

  // Сброс состояния при закрытии
  const handleClose = () => {
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
  };

  // Рендер каталога товаров
  const renderCatalog = () => (
    <div className="space-y-4">
      {/* Поиск и фильтры */}
      <div className="space-y-3">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          <input
            type="text"
            placeholder="Поиск по названию, артикулу..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-10 pr-4 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
          />
        </div>
        
        <button
          onClick={() => setShowFilters(!showFilters)}
          className="flex items-center gap-2 text-sm text-gray-600 hover:text-primary-600"
        >
          <Filter size={14} />
          {showFilters ? 'Скрыть фильтры' : 'Показать фильтры'}
        </button>
        
        {showFilters && (
          <div className="pt-2">
            <select
              value={selectedCategoryFilter}
              onChange={(e) => setSelectedCategoryFilter(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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
      <div className="bg-gray-50 rounded-lg p-4">
        <h4 className="font-medium text-gray-900 mb-3">Добавить товар</h4>
        <select
          value={selectedProduct?.id || ''}
          onChange={(e) => {
            const product = products.find(p => p.id === parseInt(e.target.value));
            setSelectedProduct(product);
            setPriceError('');
            setQuantityError('');
          }}
          className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 mb-3"
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
              <label className="block text-xs text-gray-500 mb-1">Количество</label>
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
                  quantityError ? 'border-red-500' : 'border-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-primary-500`}
              />
              {quantityError && <p className="text-xs text-red-500 mt-1">{quantityError}</p>}
            </div>
            <div>
              <label className="block text-xs text-gray-500 mb-1">Цена (₽)</label>
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
                  priceError ? 'border-red-500' : 'border-gray-200'
                } focus:outline-none focus:ring-2 focus:ring-primary-500`}
              />
              {priceError && <p className="text-xs text-red-500 mt-1">{priceError}</p>}
            </div>
          </div>
        )}
        
        <Button
          onClick={addToCart}
          disabled={!selectedProduct || quantityError || priceError}
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
        {filteredProducts.slice(0, 5).map(product => {
          const margin = ((product.retail_price - product.cost_price) / product.cost_price) * 100;
          return (
            <div
              key={product.id}
              onClick={() => setSelectedProduct(product)}
              className={`p-3 rounded-lg border cursor-pointer transition-all ${
                selectedProduct?.id === product.id
                  ? 'border-primary-500 bg-primary-50'
                  : 'border-gray-200 hover:border-primary-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div className="flex-1">
                  <p className="font-medium text-gray-900 text-sm">{product.name}</p>
                  <p className="text-xs text-gray-500">{product.article}</p>
                  <p className="text-xs text-gray-400 mt-0.5">Маржа: {margin.toFixed(1)}%</p>
                </div>
                <div className="text-right">
                  <p className="font-bold text-primary-600 text-sm">{formatPrice(product.retail_price)}</p>
                  <p className="text-xs text-gray-500">В наличии: {product.stock} шт.</p>
                </div>
              </div>
            </div>
          );
        })}
        {filteredProducts.length === 0 && (
          <div className="text-center py-8 text-gray-500">
            <Package size={32} className="mx-auto mb-2 opacity-50" />
            <p>Товары не найдены</p>
          </div>
        )}
      </div>
    </div>
  );

  // Рендер корзины и оформления
  const renderCheckout = () => (
    <div className="space-y-4">
      {/* Корзина */}
      <div className="space-y-3">
        <h4 className="font-medium text-gray-900 flex items-center gap-2">
          <ShoppingCart size={18} />
          Корзина ({cartItems.reduce((sum, i) => sum + i.quantity, 0)} шт.)
        </h4>
        
        {cartItems.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
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
                <div key={item.id} className="p-3 bg-gray-50 rounded-lg">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <p className="font-medium text-gray-900 text-sm">{item.name}</p>
                      <p className="text-xs text-gray-500">Арт. {item.article}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-xs text-gray-500">Себест: {formatPrice(item.cost_price)}</span>
                        <span className="text-xs text-green-600">Прибыль: +{formatPrice(profit)}</span>
                      </div>
                    </div>
                    <button
                      onClick={() => removeFromCart(item.id)}
                      className="p-1 text-red-500 hover:bg-red-50 rounded"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                  <div className="flex gap-2 mt-2">
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Кол-во</label>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity - 1)}
                          className="w-6 h-6 flex items-center justify-center bg-white border rounded hover:bg-gray-100"
                        >
                          <Minus size={12} />
                        </button>
                        <input
                          type="number"
                          value={item.quantity}
                          onChange={(e) => updateQuantity(item.id, parseInt(e.target.value))}
                          className="w-12 text-center text-sm border rounded py-1"
                          min="1"
                          max={item.stock}
                        />
                        <button
                          onClick={() => updateQuantity(item.id, item.quantity + 1)}
                          className="w-6 h-6 flex items-center justify-center bg-white border rounded hover:bg-gray-100"
                        >
                          <Plus size={12} />
                        </button>
                      </div>
                    </div>
                    <div className="flex-1">
                      <label className="text-xs text-gray-500">Цена (₽)</label>
                      <input
                        type="number"
                        value={item.selling_price}
                        onChange={(e) => updatePrice(item.id, parseFloat(e.target.value))}
                        className="w-full px-2 py-1 text-sm border rounded focus:outline-none focus:ring-2 focus:ring-primary-500"
                        step="0.01"
                      />
                    </div>
                    <div className="flex-1 text-right">
                      <label className="text-xs text-gray-500">Сумма</label>
                      <p className="font-semibold text-sm">{formatPrice(item.selling_price * item.quantity)}</p>
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
        <div className="border-t pt-3 space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-gray-600">Сумма:</span>
            <span className="font-medium">{formatPrice(totals.subtotal)}</span>
          </div>
          <div className="flex justify-between text-sm text-green-600">
            <span>Прибыль:</span>
            <span className="font-medium">{formatPrice(totals.totalProfit)}</span>
          </div>
          
          {/* Скидка в процентах */}
          <div className="flex justify-between items-center">
            <div className="flex items-center gap-2">
              <Percent size={14} className="text-gray-400" />
              <span className="text-gray-600 text-sm">Скидка:</span>
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
                min="0"
                max="100"
              />
              <span className="text-gray-600 text-sm">%</span>
              <span className="text-gray-600 text-sm">(-{formatPrice(totals.discountAmount)})</span>
            </div>
          </div>
          
          <div className="flex justify-between text-lg font-bold pt-2 border-t">
            <span>Итого:</span>
            <span className="text-primary-600">{formatPrice(totals.totalWithDiscount)}</span>
          </div>
        </div>
      )}

      {/* Данные покупателя */}
      <div className="border-t pt-4 space-y-3">
        <h4 className="font-medium text-gray-900">Данные покупателя</h4>
        <div className="space-y-2">
          <div className="relative">
            <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="text"
              placeholder="Имя покупателя *"
              value={customerName}
              onChange={(e) => setCustomerName(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
              required
            />
          </div>
          <div className="relative">
            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
            <input
              type="tel"
              placeholder="Телефон *"
              value={customerPhone}
              onChange={(e) => setCustomerPhone(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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
  );

  // Рендер успешного оформления
  const renderSuccess = () => (
    <div className="text-center py-8">
      <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
        <CheckCircle size={32} className="text-green-600" />
      </div>
      <h3 className="text-xl font-bold text-gray-900 mb-2">Заказ оформлен!</h3>
      <p className="text-gray-500 mb-4">
        Спасибо за покупку! Заказ успешно создан.
      </p>
      {currentOrder && (
        <div className="bg-gray-50 rounded-lg p-4 mb-4 text-left">
          <p className="text-sm font-medium text-gray-900 mb-2">Детали заказа:</p>
          <p className="text-sm text-gray-600">Номер: {currentOrder.number}</p>
          <p className="text-sm text-gray-600">Товаров: {currentOrder.items.length} шт.</p>
          <p className="text-sm text-gray-600">Сумма: {formatPrice(currentOrder.totals.subtotal)}</p>
          {currentOrder.discountPercent > 0 && (
            <p className="text-sm text-gray-600">Скидка: {currentOrder.discountPercent}%</p>
          )}
          <p className="text-sm font-semibold text-primary-600">
            Итого: {formatPrice(currentOrder.totals.totalWithDiscount)}
          </p>
          <p className="text-sm text-gray-600 mt-2">Покупатель: {currentOrder.customer.name}</p>
          <p className="text-sm text-gray-600">Телефон: {currentOrder.customer.phone}</p>
        </div>
      )}
      <Button onClick={handleClose} fullWidth>
        Закрыть
      </Button>
    </div>
  );

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={step === 'catalog' ? 'Новый заказ' : step === 'checkout' ? 'Оформление заказа' : 'Заказ оформлен'}
      size="lg"
    >
      {step === 'catalog' && renderCatalog()}
      {step === 'checkout' && renderCheckout()}
      {step === 'success' && renderSuccess()}
      
      {/* Кнопка перехода к корзине */}
      {step === 'catalog' && cartItems.length > 0 && (
        <div className="mt-4 pt-4 border-t">
          <button
            onClick={() => setStep('checkout')}
            className="w-full py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center justify-center gap-2"
          >
            <ShoppingCart size={18} />
            Перейти к оформлению ({cartItems.reduce((sum, i) => sum + i.quantity, 0)} товаров на {formatPrice(totals.subtotal)})
          </button>
        </div>
      )}
    </Modal>
  );
};