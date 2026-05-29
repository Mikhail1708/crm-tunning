// frontend/src/components/modals/EditOrderModal.tsx
import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { Input } from '../ui/Input';
import { Table, Thead, Tbody, Tr, Th, Td } from '../ui/Table';
import { productsApi } from '../../api/products';
import { saleDocumentsApi } from '../../api/saleDocuments';
import { Product, SaleDocument } from '../../types';
import { formatPrice, formatPhone } from '../../utils/formatters';
import { 
  Search, 
  Plus, 
  Trash2, 
  Minus, 
  ShoppingCart, 
  Save,
  Percent,
  User,
  AlertCircle
} from 'lucide-react';
import toast from 'react-hot-toast';

interface EditOrderModalProps {
  isOpen: boolean;
  onClose: () => void;
  order: SaleDocument | null;
  onOrderUpdated: () => void;
}

interface CartItem {
  id?: number;
  productId: number;
  productName: string;
  productArticle: string;
  quantity: number;
  price: number;
  total: number;
  stock: number;
  isNew?: boolean;
}

export const EditOrderModal: React.FC<EditOrderModalProps> = ({
  isOpen,
  onClose,
  order,
  onOrderUpdated,
}) => {
  const [cart, setCart] = useState<CartItem[]>([]);
  const [discount, setDiscount] = useState<number>(0);
  const [description, setDescription] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [searchResults, setSearchResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState<boolean>(false);
  const [showProductSearch, setShowProductSearch] = useState<boolean>(false);
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [loadingProducts, setLoadingProducts] = useState<boolean>(false);

  const [clientData, setClientData] = useState({
    name: '',
    phone: '',
    email: '',
    city: '',
    address: '',
  });

  // Загрузка всех товаров при открытии модалки поиска
  useEffect(() => {
    if (isOpen && showProductSearch && allProducts.length === 0) {
      loadAllProducts();
    }
  }, [isOpen, showProductSearch]);

  const loadAllProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await productsApi.getAll({ limit: 200 });
      setAllProducts(response.data || []);
    } catch (error) {
      console.error('Error loading products:', error);
      toast.error('Ошибка загрузки товаров');
    } finally {
      setLoadingProducts(false);
    }
  };

  // Фильтрация товаров на фронтенде
  const filteredProducts = useMemo(() => {
    if (!searchQuery.trim()) {
      return [];
    }
    
    const query = searchQuery.toLowerCase().trim();
    return allProducts.filter(product => {
      return (
        product.name.toLowerCase().includes(query) ||
        (product.article && product.article.toLowerCase().includes(query)) ||
        (product.description && product.description.toLowerCase().includes(query))
      );
    }).slice(0, 20);
  }, [allProducts, searchQuery]);

  // Инициализация корзины из заказа
  useEffect(() => {
    if (order && isOpen) {
      const initialCart: CartItem[] = (order.items || []).map(item => ({
        id: item.id,
        productId: item.productId,
        productName: item.productName,
        productArticle: item.productArticle,
        quantity: item.quantity,
        price: item.price,
        total: item.total,
        stock: 999,
      }));
      setCart(initialCart);
      setDiscount(order.discount || 0);
      setDescription(order.description || '');
      
      const client = (order as any).client;
      if (client) {
        const fullName = [client.lastName, client.firstName, client.middleName]
          .filter(Boolean)
          .join(' ');
        setClientData({
          name: fullName || client.firstName || order.customerName || '',
          phone: client.phone || order.customerPhone || '',
          email: client.email || order.customerEmail || '',
          city: client.city || order.customerCity || '',
          address: order.customerAddress || '',
        });
      } else {
        setClientData({
          name: order.customerName || order.clientName || '',
          phone: order.customerPhone || order.clientPhone || '',
          email: order.customerEmail || '',
          city: order.customerCity || '',
          address: order.customerAddress || '',
        });
      }
      
      loadStockForCart(initialCart);
    }
  }, [order, isOpen]);

  const loadStockForCart = async (cartItems: CartItem[]) => {
    if (cartItems.length === 0) return;
    
    try {
      const productIds = cartItems.map(item => item.productId);
      const responses = await Promise.all(
        productIds.map(id => productsApi.getById(id))
      );
      
      const stockMap = new Map<number, number>();
      responses.forEach((res, idx) => {
        if (res.data) {
          stockMap.set(productIds[idx], res.data.stock);
        }
      });
      
      setCart(prev => prev.map(item => ({
        ...item,
        stock: stockMap.get(item.productId) || item.stock,
      })));
    } catch (error) {
      console.error('Error loading stock:', error);
    }
  };

  const addToCart = (product: Product) => {
    const existingItem = cart.find(item => item.productId === product.id);
    
    if (existingItem) {
      toast.error('Товар уже добавлен в корзину');
      return;
    }
    
    if (product.stock <= 0) {
      toast.error(`Товар "${product.name}" отсутствует на складе`);
      return;
    }
    
    const newItem: CartItem = {
      productId: product.id,
      productName: product.name,
      productArticle: product.article || '—',
      quantity: 1,
      price: product.retail_price,
      total: product.retail_price,
      stock: product.stock,
      isNew: true,
    };
    
    setCart(prev => [...prev, newItem]);
    setShowProductSearch(false);
    setSearchQuery('');
    toast.success(`Товар "${product.name}" добавлен`);
  };

  const updateQuantity = (index: number, newQuantity: number) => {
    if (newQuantity < 1) {
      removeItem(index);
      return;
    }
    
    const item = cart[index];
    if (newQuantity > item.stock && !item.id) {
      toast.error(`Недостаточно товара на складе. Доступно: ${item.stock}`);
      return;
    }
    
    const newCart = [...cart];
    newCart[index] = {
      ...item,
      quantity: newQuantity,
      total: newQuantity * item.price,
    };
    setCart(newCart);
  };

  const updatePrice = (index: number, newPrice: number) => {
    if (newPrice < 0) return;
    
    const newCart = [...cart];
    newCart[index] = {
      ...newCart[index],
      price: newPrice,
      total: newPrice * newCart[index].quantity,
    };
    setCart(newCart);
  };

  const removeItem = (index: number) => {
    setCart(prev => prev.filter((_, i) => i !== index));
    toast.success('Товар удален из корзины');
  };

  const subtotal = useMemo(() => {
    return cart.reduce((sum, item) => sum + item.total, 0);
  }, [cart]);

  const total = useMemo(() => {
    return Math.max(0, subtotal - discount);
  }, [subtotal, discount]);

  const validateStock = useCallback(async () => {
    for (const item of cart) {
      if (item.isNew && item.quantity > item.stock) {
        toast.error(`Недостаточно товара "${item.productName}". Доступно: ${item.stock}`);
        return false;
      }
    }
    
    for (const item of cart) {
      if (!item.isNew && item.id) {
        const originalItem = order?.items?.find(i => i.id === item.id);
        const quantityDelta = item.quantity - (originalItem?.quantity || 0);
        
        if (quantityDelta > 0 && quantityDelta > item.stock) {
          toast.error(`Недостаточно товара "${item.productName}" для увеличения количества. Доступно: ${item.stock}`);
          return false;
        }
      }
    }
    return true;
  }, [cart, order]);

  const handleSave = async () => {
    if (!order) return;
    
    if (cart.length === 0) {
      toast.error('Заказ не может быть пустым');
      return;
    }
    
    const stockValid = await validateStock();
    if (!stockValid) return;
    
    setLoading(true);
    
    try {
      const updateData = {
        items: cart.map(item => ({
          id: item.id,
          productId: item.productId,
          quantity: item.quantity,
          price: item.price,
        })),
        discount: discount,
        description: description,
        clientData: clientData,
      };
      
      await saleDocumentsApi.updateFullOrder(order.id, updateData);
      
      toast.success('Заказ успешно обновлен');
      onOrderUpdated();
      onClose();
    } catch (error) {
      console.error('Error updating order:', error);
      toast.error('Ошибка при обновлении заказа');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={`Редактирование заказа №${order?.documentNumber || ''}`}
      size="xl"
    >
      <div className="space-y-6 max-h-[80vh] overflow-y-auto px-1">
        {/* Информация о клиенте */}
        <div className="bg-gray-50 dark:bg-gray-900/50 rounded-lg p-4">
          <h3 className="text-md font-semibold mb-3 flex items-center gap-2">
            <User size={18} />
            Информация о покупателе
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <Input
              label="ФИО"
              value={clientData.name}
              onChange={(e) => setClientData(prev => ({ ...prev, name: e.target.value }))}
              placeholder="ФИО покупателя"
            />
            <Input
              label="Телефон"
              value={clientData.phone}
              onChange={(e) => setClientData(prev => ({ ...prev, phone: formatPhone(e.target.value) }))}
              placeholder="+7 (___) ___-__-__"
            />
            <Input
              label="Email"
              value={clientData.email}
              onChange={(e) => setClientData(prev => ({ ...prev, email: e.target.value }))}
              placeholder="email@example.com"
            />
            <Input
              label="Город"
              value={clientData.city}
              onChange={(e) => setClientData(prev => ({ ...prev, city: e.target.value }))}
              placeholder="Город"
            />
            <div className="md:col-span-2">
              <Input
                label="Адрес"
                value={clientData.address}
                onChange={(e) => setClientData(prev => ({ ...prev, address: e.target.value }))}
                placeholder="Адрес доставки"
              />
            </div>
          </div>
        </div>

        {/* Корзина */}
        <div>
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-md font-semibold flex items-center gap-2">
              <ShoppingCart size={18} />
              Состав заказа ({cart.length} товаров)
            </h3>
            <Button
              size="sm"
              variant="outline"
              icon={Plus}
              onClick={() => setShowProductSearch(true)}
            >
              Добавить товар
            </Button>
          </div>

          {cart.length === 0 ? (
            <div className="text-center py-8 text-gray-500 border-2 border-dashed rounded-lg">
              <ShoppingCart size={48} className="mx-auto mb-2 opacity-50" />
              <p>Корзина пуста</p>
              <Button
                size="sm"
                variant="outline"
                className="mt-2"
                onClick={() => setShowProductSearch(true)}
              >
                Добавить товары
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <Thead>
                  <Tr>
                    <Th>Артикул</Th>
                    <Th>Наименование</Th>
                    <Th className="w-24">Кол-во</Th>
                    <Th className="w-32">Цена</Th>
                    <Th className="w-32">Сумма</Th>
                    <Th className="w-12"></Th>
                  </Tr>
                </Thead>
                <Tbody>
                  {cart.map((item, idx) => {
                    return (
                      <Tr key={idx}>
                        <Td className="font-mono text-sm">{item.productArticle}</Td>
                        <Td className="font-medium">{item.productName}</Td>
                        <Td>
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => updateQuantity(idx, item.quantity - 1)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                            >
                              <Minus size={14} />
                            </button>
                            <input
                              type="number"
                              value={item.quantity}
                              onChange={(e) => updateQuantity(idx, parseInt(e.target.value) || 1)}
                              className="w-16 text-center border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
                              min="1"
                              max={item.stock}
                            />
                            <button
                              onClick={() => updateQuantity(idx, item.quantity + 1)}
                              className="p-1 rounded hover:bg-gray-100 dark:hover:bg-gray-700"
                              disabled={item.quantity >= item.stock && !item.id}
                            >
                              <Plus size={14} />
                            </button>
                          </div>
                        </Td>
                        <Td>
                          <input
                            type="number"
                            value={item.price}
                            onChange={(e) => updatePrice(idx, parseFloat(e.target.value) || 0)}
                            className="w-24 text-right border rounded px-2 py-1 dark:bg-gray-700 dark:border-gray-600"
                            step="100"
                            min="0"
                          />
                        </Td>
                        <Td className="font-semibold">{formatPrice(item.total)}</Td>
                        <Td>
                          <button
                            onClick={() => removeItem(idx)}
                            className="p-1 text-red-500 hover:text-red-700"
                          >
                            <Trash2 size={16} />
                          </button>
                        </Td>
                      </Tr>
                    );
                  })}
                </Tbody>
              </Table>
            </div>
          )}
        </div>

        {/* Скидка и итог - убран подытог */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium mb-1 flex items-center gap-1">
              <Percent size={14} />
              Скидка (₽)
            </label>
            <input
              type="text"
              value={discount === 0 ? '' : discount}
              onChange={(e) => {
                const value = e.target.value;
                if (value === '') {
                  setDiscount(0);
                } else {
                  const numValue = parseInt(value.replace(/\D/g, ''), 10);
                  if (!isNaN(numValue)) {
                    setDiscount(Math.min(numValue, subtotal));
                  }
                }
              }}
              onKeyDown={(e) => {
                if (e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' || e.key === 'Escape' || e.key === 'Enter') {
                  return;
                }
                if (!/^\d$/.test(e.key)) {
                  e.preventDefault();
                }
              }}
              placeholder="0"
              className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            />
            {discount > 0 && (
              <p className="text-xs text-green-600 mt-1">
                Скидка {subtotal > 0 ? Math.round((discount / subtotal) * 100) : 0}% от суммы
              </p>
            )}
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Итоговая сумма</label>
            <div className="text-2xl font-bold text-primary-600">{formatPrice(total)}</div>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium mb-1">Комментарий к заказу</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 dark:bg-gray-700 dark:border-gray-600"
            rows={3}
            placeholder="Дополнительная информация..."
          />
        </div>

        {cart.some(item => item.isNew) && (
          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 rounded-lg p-3 flex items-start gap-2">
            <AlertCircle size={18} className="text-yellow-600 mt-0.5" />
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              Добавлены новые товары. При сохранении они будут списаны со склада.
            </p>
          </div>
        )}

        <div className="flex justify-end gap-3 pt-4 border-t">
          <Button variant="secondary" onClick={onClose} disabled={loading}>
            Отмена
          </Button>
          <Button
            variant="primary"
            onClick={handleSave}
            loading={loading}
            icon={Save}
            disabled={cart.length === 0}
          >
            Сохранить изменения
          </Button>
        </div>
      </div>

      {/* Модалка поиска товаров */}
      <Modal
        isOpen={showProductSearch}
        onClose={() => {
          setShowProductSearch(false);
          setSearchQuery('');
        }}
        title="Добавить товар"
        size="lg"
      >
        <div className="space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Поиск по названию, артикулу..."
              className="w-full pl-10 pr-4 py-2 border rounded-lg dark:bg-gray-700 dark:border-gray-600"
              autoFocus
            />
          </div>
          
          {loadingProducts && (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
              <p className="text-sm text-gray-500 mt-2">Загрузка товаров...</p>
            </div>
          )}
          
          {!loadingProducts && searchQuery && filteredProducts.length === 0 && (
            <div className="text-center py-8 text-gray-500">
              <p>Ничего не найдено по запросу "{searchQuery}"</p>
            </div>
          )}
          
          {!loadingProducts && !searchQuery && (
            <div className="text-center py-8 text-gray-400">
              <Search size={48} className="mx-auto mb-2 opacity-50" />
              <p>Введите название или артикул для поиска</p>
            </div>
          )}
          
          <div className="max-h-96 overflow-y-auto space-y-2">
            {filteredProducts.map((product) => (
              <div
                key={product.id}
                className={`flex items-center justify-between p-3 border rounded-lg hover:bg-gray-50 dark:hover:bg-gray-800 cursor-pointer transition-colors ${
                  product.stock <= 0 ? 'opacity-50 bg-red-50 dark:bg-red-900/10' : ''
                }`}
                onClick={() => product.stock > 0 && addToCart(product)}
              >
                <div className="flex-1">
                  <p className="font-medium">{product.name}</p>
                  <p className="text-sm text-gray-500">
                    Арт: {product.article || '—'} | Остаток: {product.stock} шт.
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-semibold text-primary-600">{formatPrice(product.retail_price)}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </Modal>
    </Modal>
  );
};