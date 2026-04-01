// frontend/src/pages/NewOrder.jsx
import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { productsApi } from '../api/products';
import { categoriesApi } from '../api/categories';
import { saleDocumentsApi } from '../api/saleDocuments';
import { clientsApi } from '../api/clients';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { formatPrice } from '../utils/formatters';
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
  Building2
} from 'lucide-react';
import toast from 'react-hot-toast';

// Функция валидации телефона
const validatePhone = (phone) => {
  if (!phone) return 'Телефон обязателен';
  
  // Удаляем все нецифровые символы для проверки
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 0) return 'Введите номер телефона';
  if (digits.length < 10) return 'Номер телефона должен содержать минимум 10 цифр';
  if (digits.length > 12) return 'Номер телефона слишком длинный';
  
  return null;
};

// Функция форматирования телефона
const formatPhone = (value) => {
  // Удаляем все нецифровые символы
  const digits = value.replace(/\D/g, '');
  
  if (digits.length === 0) return '';
  
  // Форматируем для России
  if (digits.length <= 1) return `+7`;
  if (digits.length <= 4) return `+7 (${digits.slice(1, 4)}`;
  if (digits.length <= 7) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}`;
  if (digits.length <= 9) return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}`;
  
  return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
};

// 🔧 Новая функция для правильного разбора ФИО
const parseFullName = (fullName) => {
  if (!fullName || !fullName.trim()) {
    return { firstName: '', lastName: '', middleName: '' };
  }
  
  // Разбиваем строку на части (по пробелам)
  const parts = fullName.trim().split(/\s+/);
  
  let firstName = '';
  let lastName = '';
  let middleName = '';
  
  if (parts.length === 1) {
    // Только имя
    firstName = parts[0];
    lastName = '';
    middleName = '';
  } else if (parts.length === 2) {
    // Имя и фамилия (считаем, что первое - имя, второе - фамилия)
    firstName = parts[0];
    lastName = parts[1];
    middleName = '';
  } else if (parts.length === 3) {
    // Фамилия, имя, отчество (стандартный русский формат)
    lastName = parts[0];
    firstName = parts[1];
    middleName = parts[2];
  } else {
    // Больше 3 слов - объединяем лишние в фамилию
    // Например: "Иванов Петр Сидорович" -> уже 3 слова
    // Если больше: "Иванов Иван Иванович Иванов" - берем последние 2 как имя и отчество
    lastName = parts.slice(0, parts.length - 2).join(' ');
    firstName = parts[parts.length - 2];
    middleName = parts[parts.length - 1];
  }
  
  return { firstName, lastName, middleName };
};

// Компонент поиска клиента
const ClientSearch = ({ selectedClient, onSelect, onClear }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = React.useRef(null);

  React.useEffect(() => {
    const handleClickOutside = (event) => {
      if (searchRef.current && !searchRef.current.contains(event.target)) {
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
      <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
        <div className="flex justify-between items-start">
          <div>
            <p className="font-medium text-gray-900">{fullName}</p>
            <p className="text-sm text-gray-600 mt-0.5">📞 {selectedClient.phone}</p>
            {selectedClient.city && (
              <p className="text-sm text-gray-600 mt-0.5">🏙️ {selectedClient.city}</p>
            )}
            {selectedClient.carModel && (
              <p className="text-sm text-gray-600">🚗 {selectedClient.carModel}</p>
            )}
          </div>
          <button onClick={onClear} className="p-1 hover:bg-blue-100 rounded">
            <X size={16} className="text-gray-500" />
          </button>
        </div>
      </div>
    );
  }

  return (
    <div ref={searchRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
        <input
          type="text"
          placeholder="Поиск клиента по имени или телефону..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
        />
      </div>
      
      {showResults && (results.length > 0 || loading) && (
        <div className="absolute z-10 w-full mt-1 bg-white border rounded-lg shadow-lg max-h-48 overflow-y-auto">
          {loading ? (
            <div className="p-3 text-center text-gray-500 text-sm">Поиск...</div>
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
                  {client.city && (
                    <div className="text-xs text-gray-400 mt-0.5">🏙️ {client.city}</div>
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

// Основной компонент
export const NewOrder = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const clientFromState = location.state?.clientId;
  
  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('');
  
  // Корзина
  const [cartItems, setCartItems] = useState([]);
  
  // Данные клиента
  const [selectedClient, setSelectedClient] = useState(null);
  const [customerName, setCustomerName] = useState('');
  const [customerPhone, setCustomerPhone] = useState('');
  const [customerEmail, setCustomerEmail] = useState('');
  const [customerCity, setCustomerCity] = useState('');
  
  // Состояния валидации телефона
  const [phoneError, setPhoneError] = useState('');
  
  // Скидка в процентах
  const [discountPercent, setDiscountPercent] = useState(0);
  const [orderLoading, setOrderLoading] = useState(false);
  
  // Состояние для отслеживания, был ли клиент создан автоматически
  const [autoCreatedClient, setAutoCreatedClient] = useState(null);

  // Множество ID товаров в корзине для быстрой проверки
  const cartProductIds = useMemo(() => {
    return new Set(cartItems.map(item => item.id));
  }, [cartItems]);

  useEffect(() => {
    loadProducts();
    loadCategories();
    
    if (clientFromState) {
      loadClientById(clientFromState);
    }
  }, [clientFromState]);

  const loadProducts = async () => {
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

  const loadCategories = async () => {
    try {
      const { data } = await categoriesApi.getAll();
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const loadClientById = async (clientId) => {
    try {
      const response = await clientsApi.getById(clientId);
      const client = response.data;
      setSelectedClient(client);
      setCustomerName([client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ').trim() || client.firstName);
      setCustomerPhone(client.phone);
      setCustomerEmail(client.email || '');
      setCustomerCity(client.city || '');
      setPhoneError('');
    } catch (error) {
      console.error('Error loading client:', error);
    }
  };

  const handleSelectClient = (client) => {
    setSelectedClient(client);
    setCustomerName([client.lastName, client.firstName, client.middleName].filter(Boolean).join(' ').trim() || client.firstName);
    setCustomerPhone(client.phone);
    setCustomerEmail(client.email || '');
    setCustomerCity(client.city || '');
    setAutoCreatedClient(null);
    setPhoneError('');
    toast.success(`Выбран клиент: ${customerName || client.firstName}`);
  };

  const handleClearClient = () => {
    setSelectedClient(null);
    setAutoCreatedClient(null);
    // Не очищаем поля, так как пользователь может ввести новые данные
  };

  // Обработчик изменения телефона с валидацией и форматированием
  const handlePhoneChange = (e) => {
    const rawValue = e.target.value;
    const formattedValue = formatPhone(rawValue);
    setCustomerPhone(formattedValue);
    
    const error = validatePhone(formattedValue);
    setPhoneError(error || '');
    
    if (selectedClient) setSelectedClient(null);
  };

  // 🔧 ИСПРАВЛЕННАЯ функция автоматического создания клиента
  const autoCreateClient = async () => {
    if (!customerName || !customerPhone) return null;
    
    // Валидация телефона перед созданием
    const phoneValidationError = validatePhone(customerPhone);
    if (phoneValidationError) {
      toast.error(phoneValidationError);
      return null;
    }
    
    if (selectedClient) return selectedClient;
    
    try {
      // Очищаем телефон от форматирования для поиска
      const cleanPhone = customerPhone.replace(/\D/g, '');
      
      // Проверяем, существует ли клиент с таким телефоном
      const searchResponse = await clientsApi.search(cleanPhone);
      const existingClient = searchResponse.data.clients.find(
        c => c.phone.replace(/\D/g, '') === cleanPhone
      );
      
      if (existingClient) {
        // Если клиент существует, выбираем его
        setSelectedClient(existingClient);
        setCustomerName([existingClient.lastName, existingClient.firstName, existingClient.middleName].filter(Boolean).join(' ').trim() || existingClient.firstName);
        setCustomerPhone(existingClient.phone);
        setCustomerEmail(existingClient.email || '');
        setCustomerCity(existingClient.city || '');
        setPhoneError('');
        toast.success(`Найден существующий клиент: ${existingClient.firstName}`);
        return existingClient;
      }
      
      // 🔧 Правильно разбираем ФИО
      const { firstName, lastName, middleName } = parseFullName(customerName);
      
      const newClientData = {
        firstName: firstName,
        lastName: lastName,
        middleName: middleName,
        phone: customerPhone,
        email: customerEmail || null,
        city: customerCity || null
      };
      
      const response = await clientsApi.create(newClientData);
      const newClient = response.data;
      
      setSelectedClient(newClient);
      setAutoCreatedClient(newClient);
      toast.success(`Клиент "${customerName}" успешно добавлен в базу!`);
      return newClient;
      
    } catch (error) {
      console.error('Error auto creating client:', error);
      if (error.response?.data?.error) {
        toast.error(error.response.data.error);
      } else {
        toast.error('Ошибка при создании клиента');
      }
      return null;
    }
  };

  // Обновленная функция создания заказа с автоматическим созданием клиента
  const handleCreateOrder = async () => {
    if (cartItems.length === 0) {
      toast.error('Добавьте товары в заказ');
      return;
    }
    
    if (!customerName) {
      toast.error('Введите имя покупателя');
      return;
    }
    
    // Валидация телефона
    const phoneValidationError = validatePhone(customerPhone);
    if (phoneValidationError) {
      toast.error(phoneValidationError);
      return;
    }
    
    setOrderLoading(true);
    
    try {
      let finalClientId = selectedClient?.id || null;
      
      // Если клиент не выбран, создаем его автоматически
      if (!selectedClient) {
        const newClient = await autoCreateClient();
        if (newClient) {
          finalClientId = newClient.id;
        } else {
          setOrderLoading(false);
          return;
        }
      }
      
      const orderData = {
        documentType: 'order',
        clientId: finalClientId,
        customerName: customerName,
        customerPhone: customerPhone,
        customerEmail: customerEmail || null,
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
      
      toast.success('Заказ успешно создан');
      navigate(`/sales/${response.data.document.id}`);
      
    } catch (error) {
      console.error('Error creating order:', error);
      toast.error(error.response?.data?.message || 'Ошибка создания заказа');
    } finally {
      setOrderLoading(false);
    }
  };

  // Расчет итогов
  const calculateTotals = () => {
    const subtotal = cartItems.reduce((sum, item) => sum + (item.selling_price * item.quantity), 0);
    const discountAmount = subtotal * (discountPercent / 100);
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

  // Фильтрация товаров
  const filteredProducts = useMemo(() => {
  let filtered = products.filter(p => p.stock > 0);
  
  console.log('Всего товаров:', products.length);
  console.log('Выбранная категория:', selectedCategory);
  
  if (searchTerm) {
    const searchLower = searchTerm.toLowerCase();
    filtered = filtered.filter(p => 
      p.name?.toLowerCase().includes(searchLower) ||
      p.article?.toLowerCase().includes(searchLower)
    );
  }
  
  if (selectedCategory) {
    const categoryId = parseInt(selectedCategory);
    console.log('Фильтруем по категории ID:', categoryId);
    
    filtered = filtered.filter(p => {
      console.log('Товар:', p.name, 'категории:', p.categories);
      
      if (p.categories && Array.isArray(p.categories)) {
        const hasCategory = p.categories.some(cat => cat.id === categoryId);
        console.log('  - hasCategory:', hasCategory);
        return hasCategory;
      }
      if (p.categoryIds && Array.isArray(p.categoryIds)) {
        const hasCategory = p.categoryIds.includes(categoryId);
        console.log('  - hasCategory (ids):', hasCategory);
        return hasCategory;
      }
      return false;
    });
  }
  
  console.log('Отфильтровано товаров:', filtered.length);
  return filtered;
}, [products, searchTerm, selectedCategory]);

  // Добавление товара в корзину с проверкой на дубликаты
  const addToCart = (product, quantity, price) => {
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

  const updateCartQuantity = (itemId, newQuantity) => {
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

  const updateCartPrice = (itemId, newPrice) => {
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

  const removeFromCart = (itemId) => {
    setCartItems(cartItems.filter(item => item.id !== itemId));
    toast.success('Товар удален из заказа');
  };

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
        {/* Левая колонка - список товаров */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl shadow-sm border border-gray-200">
            <div className="p-4 border-b border-gray-200">
              <h2 className="text-lg font-semibold text-gray-900">Каталог товаров</h2>
              
              <div className="flex flex-wrap gap-3 mt-3">
                <div className="flex-1 min-w-[200px]">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
                    <input
                      type="text"
                      placeholder="Поиск по названию или артикулу..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full pl-10 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                    />
                  </div>
                </div>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                >
                  <option value="">Все категории</option>
                  {categories.map(category => (
                    <option key={category.id} value={category.id}>{category.name}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="bg-gray-50 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Товар</th>
                    <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Артикул</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Себест.</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Розница</th>
                    <th className="px-4 py-3 text-center text-xs font-medium text-gray-500 uppercase">Остаток</th>
                    <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Действия</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {loading ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">Загрузка...</td>
                    </tr>
                  ) : filteredProducts.length === 0 ? (
                    <tr>
                      <td colSpan="6" className="text-center py-8 text-gray-500">
                        <Package size={32} className="mx-auto mb-2 opacity-50" />
                        Товары не найдены
                      </td>
                    </tr>
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
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Правая колонка - корзина */}
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
                </div>
              ) : (
                cartItems.map(item => (
                  <CartItem
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

            {/* Поиск клиента */}
            <div className="border-t pt-4 mt-4">
              <h3 className="font-medium text-gray-900 flex items-center gap-2 mb-2">
                <Users size={16} />
                Клиент
              </h3>
              <ClientSearch
                selectedClient={selectedClient}
                onSelect={handleSelectClient}
                onClear={handleClearClient}
              />
            </div>

            {/* Данные покупателя */}
            <div className="space-y-3 mt-4">
              <h3 className="font-medium text-gray-900">Данные покупателя</h3>
              
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Имя покупателя *"
                  value={customerName}
                  onChange={(e) => {
                    setCustomerName(e.target.value);
                    if (selectedClient) setSelectedClient(null);
                  }}
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
                  onChange={handlePhoneChange}
                  className={`w-full pl-9 pr-3 py-2 rounded-lg border ${
                    phoneError ? 'border-red-500' : 'border-gray-200'
                  } focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm`}
                  required
                />
              </div>
              {phoneError && (
                <p className="text-xs text-red-500 -mt-2">{phoneError}</p>
              )}
              
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="email"
                  placeholder="Email"
                  value={customerEmail}
                  onChange={(e) => setCustomerEmail(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
                />
              </div>
              
              <div className="relative">
                <MapPin className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={16} />
                <input
                  type="text"
                  placeholder="Город"
                  value={customerCity}
                  onChange={(e) => {
                    setCustomerCity(e.target.value);
                    if (selectedClient) setSelectedClient(null);
                  }}
                  className="w-full pl-9 pr-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 text-sm"
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

// Компонент строки товара в каталоге
const ProductRow = ({ product, isInCart, onAddToCart }) => {
  const [quantity, setQuantity] = useState(1);
  const [price, setPrice] = useState(product.retail_price);
  const [quantityError, setQuantityError] = useState('');
  const [priceError, setPriceError] = useState('');

  const validateQuantity = (value) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 1) return 'Количество > 0';
    if (num > product.stock) return `Доступно ${product.stock} шт.`;
    return '';
  };

  const validatePrice = (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return 'Цена > 0';
    if (num < product.cost_price) return `Не ниже ${formatPrice(product.cost_price)}`;
    return '';
  };

  const handleQuantityChange = (e) => {
    const val = e.target.value;
    setQuantity(val);
    setQuantityError(validateQuantity(val));
  };

  const handlePriceChange = (e) => {
    const val = e.target.value;
    setPrice(val);
    setPriceError(validatePrice(val));
  };

  const handleAdd = () => {
    const qty = parseInt(quantity);
    const prc = parseFloat(price);
    
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

  const margin = ((product.retail_price - product.cost_price) / product.cost_price) * 100;

  return (
    <tr className={`hover:bg-gray-50 ${isInCart ? 'bg-green-50' : ''}`}>
      <td className="px-4 py-3">
        <div className="flex items-center gap-2">
          <div className="font-medium text-gray-900">{product.name}</div>
          {isInCart && (
            <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs bg-green-100 text-green-700 rounded-full">
              <CheckCircle size={10} />
              В корзине
            </span>
          )}
        </div>
        <div className="text-xs text-gray-500 mt-0.5">
          Маржа: {margin.toFixed(1)}%
        </div>
       </td>
      <td className="px-4 py-3 text-sm text-gray-500">{product.article}</td>
      <td className="px-4 py-3 text-right text-sm">{formatPrice(product.cost_price)}</td>
      <td className="px-4 py-3 text-right text-sm">{formatPrice(product.retail_price)}</td>
      <td className="px-4 py-3 text-center">
        <span className={`text-sm font-medium ${
          product.stock <= product.min_stock ? 'text-yellow-600' : 'text-green-600'
        }`}>
          {product.stock} шт.
        </span>
      </td>
      <td className="px-4 py-3">
        {!isInCart ? (
          <div className="flex flex-col gap-2">
            <div className="flex gap-2">
              <input
                type="number"
                value={quantity}
                onChange={handleQuantityChange}
                className="w-16 px-2 py-1 text-sm rounded border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                min="1"
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
                disabled={quantityError || priceError || product.stock === 0}
                className="p-1 text-primary-600 hover:bg-primary-50 rounded transition-colors disabled:opacity-50"
              >
                <Plus size={18} />
              </button>
            </div>
            {(quantityError || priceError) && (
              <div className="text-xs text-red-500">
                {quantityError || priceError}
              </div>
            )}
          </div>
        ) : (
          <div className="text-center text-sm text-green-600 font-medium">
            В корзине
          </div>
        )}
      </td>
    </tr>
  );
};

// Компонент строки товара в корзине
const CartItem = ({ item, onUpdateQuantity, onUpdatePrice, onRemove }) => {
  const [quantity, setQuantity] = useState(item.quantity);
  const [price, setPrice] = useState(item.selling_price);
  const [quantityError, setQuantityError] = useState('');
  const [priceError, setPriceError] = useState('');

  const validateQuantity = (value) => {
    const num = parseInt(value);
    if (isNaN(num) || num < 1) return '>0';
    if (num > item.stock) return `доступно ${item.stock}`;
    return '';
  };

  const validatePrice = (value) => {
    const num = parseFloat(value);
    if (isNaN(num) || num <= 0) return '>0';
    if (num < item.cost_price) return `не ниже ${formatPrice(item.cost_price)}`;
    return '';
  };

  const handleQuantityChange = (e) => {
    const val = e.target.value;
    setQuantity(val);
    const error = validateQuantity(val);
    setQuantityError(error);
    if (!error && val !== '') {
      onUpdateQuantity(item.id, parseInt(val));
    }
  };

  const handlePriceChange = (e) => {
    const val = e.target.value;
    setPrice(val);
    const error = validatePrice(val);
    setPriceError(error);
    if (!error && val !== '') {
      onUpdatePrice(item.id, parseFloat(val));
    }
  };

  const total = item.selling_price * item.quantity;
  const profit = (item.selling_price - item.cost_price) * item.quantity;

  return (
    <div className="border border-gray-200 rounded-lg p-3">
      <div className="flex justify-between items-start">
        <div className="flex-1">
          <p className="font-medium text-gray-900 text-sm">{item.name}</p>
          <p className="text-xs text-gray-500 mt-0.5">Арт. {item.article}</p>
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
            min="1"
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