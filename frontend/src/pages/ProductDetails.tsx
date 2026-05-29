// frontend/src/pages/ProductDetails.tsx
import React, { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { productsApi } from '../api/products';
import { categoriesApi } from '../api/categories';
import { Button } from '../components/ui/Button';
import { Card, CardBody } from '../components/ui/Card';
import { Modal } from '../components/ui/Modal';
import { Input } from '../components/ui/Input';
import { ProductCategoriesSelector } from '../components/ProductCategoriesSelector';
import { ProductCharacteristicsForm } from '../components/ProductCharacteristicsForm';
import { CostBreakdownEditor } from '../components/ui/CostBreakdownEditor';
import { formatPrice, getStockStatus } from '../utils/formatters';
import { Product, Category, CategoryField, PriceHistoryEntry, ProductImage, CostBreakdownItem, ProductCharacteristic } from '../types';
import { 
  ArrowLeft, 
  Edit, 
  Trash2, 
  Package, 
  Tag, 
  DollarSign, 
  Boxes,
  Calendar,
  User,
  TrendingUp,
  TrendingDown,
  Camera,
  X,
  Star,
  Loader,
  History,
  Save,
  Plus,
  ChevronLeft,
  ChevronRight
} from 'lucide-react';
import toast from 'react-hot-toast';

const MAX_IMAGES = 5;

// Компонент полноэкранного просмотра фото с каруселью
const FullscreenImageViewer: React.FC<{
  images: ProductImage[];
  currentIndex: number;
  onClose: () => void;
  onSetMain: (imageId: number) => void;
}> = ({ images, currentIndex, onClose, onSetMain }) => {
  const [activeIndex, setActiveIndex] = useState(currentIndex);
  const [showControls, setShowControls] = useState(true);

  useEffect(() => {
    let timer: NodeJS.Timeout;
    if (showControls) {
      timer = setTimeout(() => setShowControls(false), 3000);
    }
    return () => clearTimeout(timer);
  }, [showControls]);

  const currentImage = images[activeIndex];
  const isMain = currentImage?.isMain;

  const goPrev = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    setShowControls(true);
  };

  const goNext = (e: React.MouseEvent) => {
    e.stopPropagation();
    setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    setShowControls(true);
  };

  const handleSetMain = (e: React.MouseEvent) => {
    e.stopPropagation();
    onSetMain(currentImage.id);
    setShowControls(true);
  };

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft') {
        setActiveIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
        setShowControls(true);
      } else if (e.key === 'ArrowRight') {
        setActiveIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
        setShowControls(true);
      } else if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [images.length, onClose]);

  // Предотвращаем скролл body при открытом просмотрщике
  useEffect(() => {
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = 'unset';
    };
  }, []);

  return (
    <div 
      className="fixed inset-0 z-[9999] bg-black/95 flex items-center justify-center"
      onClick={onClose}
    >
      <div className="relative w-full h-full flex items-center justify-center">
        <img
          src={currentImage.url}
          alt={`Фото ${activeIndex + 1} из ${images.length}`}
          className="max-w-[90vw] max-h-[90vh] object-contain cursor-pointer"
          onClick={(e) => e.stopPropagation()}
          onError={(e) => {
            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/800x600?text=Image+Not+Found';
          }}
        />
        
        {/* Кнопка закрытия */}
        <button
          onClick={onClose}
          className={`absolute top-4 right-4 p-2 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all duration-300 hover:scale-110 z-10 ${
            showControls ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <X size={24} />
        </button>
        
        {/* Кнопка "Сделать главным" */}
        {!isMain && (
          <button
            onClick={handleSetMain}
            className={`absolute bottom-20 left-1/2 -translate-x-1/2 px-4 py-2 bg-yellow-500 text-white rounded-lg hover:bg-yellow-600 transition-all duration-300 flex items-center gap-2 shadow-lg z-10 ${
              showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
            }`}
          >
            <Star size={18} />
            Сделать главным
          </button>
        )}
        
        {/* Индикатор текущего фото */}
        <div className={`absolute bottom-4 left-1/2 -translate-x-1/2 px-3 py-1 bg-black/50 text-white text-sm rounded-full transition-all duration-300 z-10 ${
          showControls ? 'opacity-100' : 'opacity-0'
        }`}>
          {activeIndex + 1} / {images.length}
          {isMain && <span className="ml-2 text-yellow-400">★ Главное</span>}
        </div>
        
        {/* Кнопка назад */}
        {images.length > 1 && (
          <button
            onClick={goPrev}
            className={`absolute left-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all duration-300 hover:scale-110 z-10 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronLeft size={24} />
          </button>
        )}
        
        {/* Кнопка вперед */}
        {images.length > 1 && (
          <button
            onClick={goNext}
            className={`absolute right-4 top-1/2 -translate-y-1/2 p-3 bg-black/50 text-white rounded-full hover:bg-black/70 transition-all duration-300 hover:scale-110 z-10 ${
              showControls ? 'opacity-100' : 'opacity-0'
            }`}
          >
            <ChevronRight size={24} />
          </button>
        )}
        
        {/* Миниатюры внизу */}
        {images.length > 1 && (
          <div className={`absolute bottom-16 left-0 right-0 flex justify-center gap-2 px-4 transition-all duration-300 z-10 ${
            showControls ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-10'
          }`}>
            <div className="flex gap-2 bg-black/50 p-2 rounded-lg backdrop-blur-sm">
              {images.map((img, idx) => (
                <button
                  key={img.id}
                  onClick={(e) => {
                    e.stopPropagation();
                    setActiveIndex(idx);
                    setShowControls(true);
                  }}
                  className={`relative w-12 h-12 rounded-lg overflow-hidden border-2 transition-all ${
                    idx === activeIndex 
                      ? 'border-yellow-500 scale-110' 
                      : 'border-transparent hover:border-white/50'
                  }`}
                >
                  <img
                    src={img.url}
                    alt={`Миниатюра ${idx + 1}`}
                    className="w-full h-full object-cover"
                    onError={(e) => {
                      (e.target as HTMLImageElement).src = 'https://via.placeholder.com/50x50?text=No';
                    }}
                  />
                  {img.isMain && (
                    <div className="absolute top-0 right-0">
                      <Star size={10} fill="gold" stroke="gold" />
                    </div>
                  )}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

// Компонент галереи фото
const ProductGallery: React.FC<{
  images: ProductImage[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (imageId: number) => Promise<void>;
  onSetMain: (imageId: number) => Promise<void>;
  loading: boolean;
}> = ({ images, onUpload, onDelete, onSetMain, loading }) => {
  const [uploading, setUploading] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const handleFileSelect = () => {
    if (images.length >= MAX_IMAGES) {
      toast.error(`Максимум ${MAX_IMAGES} фото на товар`);
      return;
    }
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    if (!file.type.startsWith('image/')) {
      toast.error('Можно загружать только изображения');
      return;
    }
    
    if (file.size > 5 * 1024 * 1024) {
      toast.error('Максимальный размер фото 5MB');
      return;
    }
    
    setUploading(true);
    try {
      await onUpload(file);
      toast.success('Фото загружено');
    } catch (error) {
      console.error('Upload error:', error);
      toast.error('Ошибка загрузки фото');
    } finally {
      setUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const openImageViewer = (index: number) => {
    console.log('Opening viewer at index:', index);
    setSelectedImageIndex(index);
    setViewerOpen(true);
  };

  const mainImage = images.find(img => img.isMain);
  const otherImages = images.filter(img => !img.isMain);
  const mainImageIndex = images.findIndex(img => img.isMain);

  return (
    <div className="space-y-4">
      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/gif,image/webp"
        onChange={handleFileChange}
        className="hidden"
      />
      
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
            <Camera size={20} className="text-primary-600 dark:text-primary-400" />
            Фотографии товара
          </h3>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {images.length}/{MAX_IMAGES} фото
          </p>
        </div>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={handleFileSelect}
          disabled={uploading || loading || images.length >= MAX_IMAGES}
          icon={uploading ? Loader : Plus}
        >
          {uploading ? 'Загрузка...' : 'Загрузить фото'}
        </Button>
      </div>

      {images.length === 0 ? (
        <div 
          className="border-2 border-dashed border-gray-300 dark:border-gray-700 rounded-lg p-8 text-center cursor-pointer hover:border-primary-400 dark:hover:border-primary-500 transition-colors"
          onClick={handleFileSelect}
        >
          <Camera size={48} className="mx-auto text-gray-400 dark:text-gray-600 mb-2" />
          <p className="text-gray-500 dark:text-gray-400">Нет фотографий</p>
          <p className="text-sm text-gray-400 dark:text-gray-500">Нажмите, чтобы загрузить фото товара</p>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Главное фото */}
          {mainImage && (
            <div className="relative group cursor-pointer" onClick={() => openImageViewer(mainImageIndex)}>
              <img
                src={mainImage.url}
                alt="Главное фото"
                className="w-full h-64 object-cover rounded-lg border border-gray-200 dark:border-gray-700 transition-opacity group-hover:opacity-90"
                onError={(e) => {
                  (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x400?text=No+Image';
                }}
              />
              <div className="absolute top-2 right-2 flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity z-10">
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    onDelete(mainImage.id);
                  }}
                  className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                  title="Удалить"
                >
                  <X size={16} />
                </button>
              </div>
              <div className="absolute bottom-2 left-2 bg-black/60 text-white text-xs px-2 py-1 rounded-full flex items-center gap-1">
                <Star size={12} fill="gold" stroke="gold" />
                Главное фото
              </div>
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="bg-black/50 text-white px-3 py-1 rounded-full text-sm">
                  Нажмите для просмотра
                </span>
              </div>
            </div>
          )}

          {/* Сетка остальных фото */}
          {otherImages.length > 0 && (
            <div className="grid grid-cols-4 gap-2">
              {otherImages.map((img, idx) => {
                const absoluteIndex = images.findIndex(i => i.id === img.id);
                return (
                  <div key={img.id} className="relative group cursor-pointer" onClick={() => openImageViewer(absoluteIndex)}>
                    <img
                      src={img.url}
                      alt="Фото товара"
                      className="w-full h-24 object-cover rounded-lg border border-gray-200 dark:border-gray-700 transition-opacity group-hover:opacity-90"
                      onError={(e) => {
                        (e.target as HTMLImageElement).src = 'https://via.placeholder.com/150x150?text=No+Image';
                      }}
                    />
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-1 z-10">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onSetMain(img.id);
                        }}
                        className="p-1.5 bg-yellow-500 text-white rounded-full hover:bg-yellow-600 transition-colors"
                        title="Сделать главным"
                      >
                        <Star size={14} />
                      </button>
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onDelete(img.id);
                        }}
                        className="p-1.5 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                        title="Удалить"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Полноэкранный просмотр */}
      {viewerOpen && (
        <FullscreenImageViewer
          images={images}
          currentIndex={selectedImageIndex}
          onClose={() => setViewerOpen(false)}
          onSetMain={async (imageId) => {
            await onSetMain(imageId);
            const newIndex = images.findIndex(img => img.id === imageId);
            setSelectedImageIndex(newIndex);
          }}
        />
      )}
    </div>
  );
};

// Компонент истории цен
const PriceHistoryModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  history: PriceHistoryEntry[];
}> = ({ isOpen, onClose, history }) => {
  const [showAll, setShowAll] = useState(false);
  const displayHistory = showAll ? history : history.slice(0, 10);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="История изменения цен" size="lg">
      <div className="space-y-4">
        {history.length === 0 ? (
          <div className="text-center py-8 text-gray-500 dark:text-gray-400">
            <History size={48} className="mx-auto mb-2 opacity-50" />
            <p>История цен пуста</p>
            <p className="text-sm">При первом изменении цены здесь появится запись</p>
          </div>
        ) : (
          <>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {displayHistory.map(entry => (
                <div
                  key={entry.id}
                  className="flex items-center justify-between p-3 bg-gray-50 dark:bg-gray-800 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                >
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {entry.changeType === 'increase' ? (
                        <TrendingUp size={16} className="text-red-500" />
                      ) : (
                        <TrendingDown size={16} className="text-green-500" />
                      )}
                      <span className="font-medium text-gray-900 dark:text-white">
                        {formatPrice(entry.oldPrice)} → {formatPrice(entry.newPrice)}
                      </span>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        entry.changeType === 'increase' 
                          ? 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400' 
                          : 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400'
                      }`}>
                        {entry.changeType === 'increase' 
                          ? `+${(((entry.newPrice - entry.oldPrice) / entry.oldPrice) * 100).toFixed(1)}%` 
                          : `${(((entry.newPrice - entry.oldPrice) / entry.oldPrice) * 100).toFixed(1)}%`}
                      </span>
                    </div>
                    {entry.reason && (
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">Причина: {entry.reason}</p>
                    )}
                    <div className="flex items-center gap-4 text-xs text-gray-500 dark:text-gray-500">
                      <span className="flex items-center gap-1">
                        <User size={12} />
                        {entry.changedBy?.name || 'Пользователь'}
                      </span>
                      <span className="flex items-center gap-1">
                        <Calendar size={12} />
                        {new Date(entry.changedAt).toLocaleString('ru-RU')}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
            
            {history.length > 10 && !showAll && (
              <Button
                type="button"
                variant="outline"
                fullWidth
                onClick={() => setShowAll(true)}
              >
                Показать все ({history.length} записей)
              </Button>
            )}
          </>
        )}
      </div>
    </Modal>
  );
};

// Модалка обновления цены
const UpdatePriceModal: React.FC<{
  isOpen: boolean;
  onClose: () => void;
  currentPrice: number;
  onUpdate: (price: number, reason: string) => Promise<void>;
}> = ({ isOpen, onClose, currentPrice, onUpdate }) => {
  const [price, setPrice] = useState(currentPrice);
  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setPrice(currentPrice);
  }, [currentPrice]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (price === currentPrice) {
      toast.error('Цена не изменилась');
      return;
    }
    
    if (price < 0) {
      toast.error('Цена не может быть отрицательной');
      return;
    }
    
    setLoading(true);
    try {
      await onUpdate(price, reason);
      toast.success('Цена обновлена');
      onClose();
      setReason('');
    } catch (error) {
      console.error('Update price error:', error);
      toast.error('Ошибка обновления цены');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Изменить цену" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Текущая цена
          </label>
          <p className="text-lg font-semibold text-gray-900 dark:text-white">{formatPrice(currentPrice)}</p>
        </div>
        
        <Input
          label="Новая цена"
          type="number"
          value={price}
          onChange={(e) => setPrice(parseFloat(e.target.value))}
          step="0.01"
          min="0"
          required
        />
        
        <Input
          label="Причина изменения"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Например: Повышение закупочной цены, Акция, Сезонная скидка..."
          required
        />
        
        <div className="flex gap-3 pt-4">
          <Button type="submit" loading={loading} fullWidth>
            Сохранить
          </Button>
          <Button type="button" variant="secondary" onClick={onClose} fullWidth>
            Отмена
          </Button>
        </div>
      </form>
    </Modal>
  );
};

// Основной компонент страницы товара
export const ProductDetails: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [product, setProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [priceHistory, setPriceHistory] = useState<PriceHistoryEntry[]>([]);
  const [images, setImages] = useState<ProductImage[]>([]);
  const [showPriceHistory, setShowPriceHistory] = useState(false);
  const [showPriceModal, setShowPriceModal] = useState(false);
  const [isEditing, setIsEditing] = useState(false);
  const [priceChangeReason, setPriceChangeReason] = useState('');
  
  const [editFormData, setEditFormData] = useState({
    name: '',
    article: '',
    cost_price: 0,
    retail_price: 0,
    stock: 0,
    min_stock: 0,
    description: '',
    categoryIds: [] as number[],
    costBreakdown: [] as CostBreakdownItem[]
  });
  const [characteristics, setCharacteristics] = useState<ProductCharacteristic>({});
  const [selectedCategoryFields, setSelectedCategoryFields] = useState<CategoryField[]>([]);

  const loadData = useCallback(async () => {
    if (!id) return;
    
    try {
      setLoading(true);
      
      const [productRes, historyRes, imagesRes, categoriesRes] = await Promise.all([
        productsApi.getById(parseInt(id)),
        productsApi.getPriceHistory(parseInt(id)),
        productsApi.getImages(parseInt(id)),
        categoriesApi.getAll()
      ]);
      
      const productData = productRes.data;
      setProduct(productData);
      setPriceHistory(historyRes.data);
      setImages(imagesRes.data);
      setCategories(categoriesRes.data);
      
      setEditFormData({
        name: productData.name,
        article: productData.article || '',
        cost_price: productData.cost_price,
        retail_price: productData.retail_price,
        stock: productData.stock,
        min_stock: productData.min_stock,
        description: productData.description || '',
        categoryIds: productData.categoryIds || [],
        costBreakdown: productData.costBreakdown || []
      });
      
      setCharacteristics(productData.characteristics || {});
      
      const selectedCategories = categoriesRes.data.filter((cat: Category) => 
        (productData.categoryIds || []).includes(cat.id)
      );
      const allFields: CategoryField[] = [];
      selectedCategories.forEach((cat: Category) => {
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
      
    } catch (error) {
      console.error('Error loading product:', error);
      toast.error('Ошибка загрузки товара');
      navigate('/products');
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleUpdatePrice = async (newPrice: number, reason: string) => {
    if (!product) return;
    await productsApi.updatePrice(product.id, newPrice, reason);
    await loadData();
  };

  const handleUploadImage = async (file: File) => {
    if (!product) return;
    await productsApi.uploadImage(product.id, file);
    await loadData();
  };

  const handleDeleteImage = async (imageId: number) => {
    if (!product) return;
    if (confirm('Удалить это фото?')) {
      await productsApi.deleteImage(product.id, imageId);
      await loadData();
    }
  };

  const handleSetMainImage = async (imageId: number) => {
    if (!product) return;
    await productsApi.setMainImage(product.id, imageId);
    await loadData();
  };

  const handleUpdateProduct = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!product) return;
    
    const priceChanged = editFormData.retail_price !== product.retail_price;
    
    if (priceChanged && !priceChangeReason) {
      toast.error('Укажите причину изменения цены');
      return;
    }
    
    try {
      const updateData = {
        name: editFormData.name,
        article: editFormData.article,
        cost_price: editFormData.cost_price,
        retail_price: editFormData.retail_price,
        stock: editFormData.stock,
        min_stock: editFormData.min_stock,
        description: editFormData.description,
        categoryIds: editFormData.categoryIds,
        characteristics: characteristics,
        costBreakdown: editFormData.costBreakdown,
        priceChangeReason: priceChanged ? priceChangeReason : undefined
      };
      
      await productsApi.update(product.id, updateData);
      toast.success('Товар обновлен');
      setIsEditing(false);
      setPriceChangeReason('');
      await loadData();
    } catch (error) {
      console.error('Update error:', error);
      toast.error('Ошибка обновления товара');
    }
  };

  const handleDeleteProduct = async () => {
    if (!product) return;
    if (confirm(`Удалить товар "${product.name}"? Это действие нельзя отменить.`)) {
      try {
        await productsApi.delete(product.id);
        toast.success('Товар удален');
        navigate('/products');
      } catch (error) {
        console.error('Delete error:', error);
        toast.error('Ошибка удаления товара');
      }
    }
  };

  const handleCategoryChange = (categoryIds: number[]) => {
    setEditFormData(prev => ({ ...prev, categoryIds }));
    
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
  };

  const handleCostBreakdownChange = (items: CostBreakdownItem[]) => {
    const totalCost = items.reduce((sum, item) => sum + (item.amount || 0), 0);
    setEditFormData(prev => ({
      ...prev,
      costBreakdown: items,
      cost_price: totalCost
    }));
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <Loader className="animate-spin text-primary-600" size={48} />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="text-center py-12">
        <Package size={64} className="mx-auto text-gray-400 dark:text-gray-600 mb-4" />
        <h2 className="text-2xl font-bold text-gray-700 dark:text-gray-300">Товар не найден</h2>
        <Button onClick={() => navigate('/products')} className="mt-4">
          Вернуться к списку
        </Button>
      </div>
    );
  }

  const stockStatus = getStockStatus(product.stock, product.min_stock);
  const margin = product.cost_price > 0 
    ? ((product.retail_price - product.cost_price) / product.cost_price) * 100 
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center gap-4">
          <button
            onClick={() => navigate('/products')}
            className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
          >
            <ArrowLeft size={24} className="text-gray-700 dark:text-gray-300" />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{product.name}</h1>
            <p className="text-gray-500 dark:text-gray-400">Артикул: {product.article || '—'}</p>
          </div>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            icon={History}
            onClick={() => setShowPriceHistory(true)}
          >
            История цен
          </Button>
          <Button
            variant="outline"
            icon={Edit}
            onClick={() => setIsEditing(true)}
          >
            Редактировать
          </Button>
          <Button
            variant="danger"
            icon={Trash2}
            onClick={handleDeleteProduct}
          >
            Удалить
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-1">
          <Card>
            <CardBody className="p-4">
              <ProductGallery
                images={images}
                onUpload={handleUploadImage}
                onDelete={handleDeleteImage}
                onSetMain={handleSetMainImage}
                loading={loading}
              />
            </CardBody>
          </Card>
        </div>

        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardBody className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <DollarSign size={16} />
                    <span className="text-sm">Розничная цена</span>
                  </div>
                  <p className="text-3xl font-bold text-gray-900 dark:text-white">
                    {formatPrice(product.retail_price)}
                  </p>
                  <button
                    onClick={() => setShowPriceModal(true)}
                    className="mt-2 text-sm text-primary-600 dark:text-primary-400 hover:underline"
                  >
                    Изменить цену
                  </button>
                </div>
                
                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Package size={16} />
                    <span className="text-sm">Себестоимость</span>
                  </div>
                  <p className="text-2xl font-semibold text-gray-700 dark:text-gray-300">
                    {formatPrice(product.cost_price)}
                  </p>
                  <p className={`text-sm mt-1 ${margin >= 0 ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}`}>
                    Маржа: {margin.toFixed(1)}%
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Boxes size={16} />
                    <span className="text-sm">Остаток на складе</span>
                  </div>
                  <p className={`text-2xl font-semibold ${stockStatus.color}`}>
                    {product.stock} шт.
                  </p>
                  <p className="text-sm text-gray-500 dark:text-gray-400">
                    Мин. остаток: {product.min_stock} шт.
                  </p>
                </div>

                <div>
                  <div className="flex items-center gap-2 text-gray-500 dark:text-gray-400 mb-1">
                    <Tag size={16} />
                    <span className="text-sm">Категории</span>
                  </div>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {product.categories && product.categories.length > 0 ? (
                      product.categories.map(cat => (
                        <span key={cat.id} className="px-2 py-1 text-xs rounded-full bg-primary-100 dark:bg-primary-900/30 text-primary-700 dark:text-primary-400">
                          {cat.name}
                        </span>
                      ))
                    ) : (
                      <span className="text-gray-400 dark:text-gray-600">—</span>
                    )}
                  </div>
                </div>
              </div>
            </CardBody>
          </Card>

          {product.characteristics && Object.keys(product.characteristics).length > 0 && (
            <Card>
              <CardBody className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Характеристики</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {Object.entries(product.characteristics).map(([key, value]) => (
                    <div key={key} className="border-b border-gray-100 dark:border-gray-800 pb-2">
                      <p className="text-sm text-gray-500 dark:text-gray-400">{key}</p>
                      <p className="font-medium text-gray-900 dark:text-white">
                        {Array.isArray(value) ? value.join(', ') : String(value)}
                      </p>
                    </div>
                  ))}
                </div>
              </CardBody>
            </Card>
          )}

          {product.description && (
            <Card>
              <CardBody className="p-6">
                <h3 className="text-lg font-semibold mb-2 text-gray-900 dark:text-white">Описание</h3>
                <p className="text-gray-600 dark:text-gray-400 whitespace-pre-wrap">{product.description}</p>
              </CardBody>
            </Card>
          )}

          {product.costBreakdown && product.costBreakdown.length > 0 && (
            <Card>
              <CardBody className="p-6">
                <h3 className="text-lg font-semibold mb-4 text-gray-900 dark:text-white">Калькуляция себестоимости</h3>
                <div className="space-y-2">
                  {product.costBreakdown.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-2 border-b border-gray-100 dark:border-gray-800">
                      <span className="font-medium text-gray-700 dark:text-gray-300">{item.name}</span>
                      <span className="font-semibold text-gray-900 dark:text-white">{formatPrice(item.amount)}</span>
                    </div>
                  ))}
                  <div className="flex justify-between items-center pt-2 font-bold text-lg">
                    <span className="text-gray-900 dark:text-white">Итого:</span>
                    <span className="text-primary-600 dark:text-primary-400">{formatPrice(product.cost_price)}</span>
                  </div>
                </div>
              </CardBody>
            </Card>
          )}

          <Card>
            <CardBody className="p-6">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Создан:</span>
                  <span className="ml-2 text-gray-700 dark:text-gray-300">{new Date(product.createdAt).toLocaleString('ru-RU')}</span>
                </div>
                <div>
                  <span className="text-gray-500 dark:text-gray-400">Обновлен:</span>
                  <span className="ml-2 text-gray-700 dark:text-gray-300">{new Date(product.updatedAt).toLocaleString('ru-RU')}</span>
                </div>
              </div>
            </CardBody>
          </Card>
        </div>
      </div>

      <PriceHistoryModal
        isOpen={showPriceHistory}
        onClose={() => setShowPriceHistory(false)}
        history={priceHistory}
      />

      <UpdatePriceModal
        isOpen={showPriceModal}
        onClose={() => setShowPriceModal(false)}
        currentPrice={product.retail_price}
        onUpdate={handleUpdatePrice}
      />

      <Modal
        isOpen={isEditing}
        onClose={() => {
          setIsEditing(false);
          setPriceChangeReason('');
        }}
        title="Редактировать товар"
        size="lg"
      >
        <form onSubmit={handleUpdateProduct} className="space-y-4 max-h-[70vh] overflow-y-auto px-1">
          <Input
            label="Название товара"
            value={editFormData.name}
            onChange={(e) => setEditFormData({ ...editFormData, name: e.target.value })}
            required
          />
          
          <Input
            label="Артикул"
            value={editFormData.article}
            onChange={(e) => setEditFormData({ ...editFormData, article: e.target.value })}
          />
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Себестоимость (₽)"
              type="number"
              value={editFormData.cost_price}
              onChange={(e) => setEditFormData({ ...editFormData, cost_price: parseFloat(e.target.value) })}
              step="0.01"
              required
            />
            <Input
              label="Розничная цена (₽)"
              type="number"
              value={editFormData.retail_price}
              onChange={(e) => setEditFormData({ ...editFormData, retail_price: parseFloat(e.target.value) })}
              step="0.01"
              required
            />
          </div>
          
          {editFormData.retail_price !== product?.retail_price && (
            <Input
              label="Причина изменения цены"
              value={priceChangeReason}
              onChange={(e) => setPriceChangeReason(e.target.value)}
              placeholder="Например: Повышение закупочной цены, Сезонная скидка"
              required
            />
          )}
          
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Остаток на складе"
              type="number"
              value={editFormData.stock}
              onChange={(e) => setEditFormData({ ...editFormData, stock: parseInt(e.target.value) })}
              required
            />
            <Input
              label="Минимальный остаток"
              type="number"
              value={editFormData.min_stock}
              onChange={(e) => setEditFormData({ ...editFormData, min_stock: parseInt(e.target.value) })}
              required
            />
          </div>
          
          <ProductCategoriesSelector
            categories={categories}
            selectedCategoryIds={editFormData.categoryIds}
            onChange={handleCategoryChange}
          />
          
          <div className="border-t border-gray-200 dark:border-gray-700 pt-4">
            <CostBreakdownEditor
              value={editFormData.costBreakdown}
              onChange={handleCostBreakdownChange}
              disabled={false}
            />
          </div>
          
          <ProductCharacteristicsForm
            fields={selectedCategoryFields}
            characteristics={characteristics}
            onChange={(fieldId, value) => setCharacteristics(prev => ({ ...prev, [fieldId]: value }))}
          />
          
          <Input
            label="Описание"
            value={editFormData.description}
            onChange={(e) => setEditFormData({ ...editFormData, description: e.target.value })}
            multiline
            rows={3}
            placeholder="Дополнительная информация о товаре..."
          />
          
          <div className="flex gap-3 pt-4 sticky bottom-0 bg-white dark:bg-gray-900 py-4 border-t border-gray-100 dark:border-gray-800">
            <Button type="submit" fullWidth icon={Save}>
              Сохранить изменения
            </Button>
            <Button type="button" variant="secondary" onClick={() => {
              setIsEditing(false);
              setPriceChangeReason('');
            }} fullWidth>
              Отмена
            </Button>
          </div>
        </form>
      </Modal>
    </div>
  );
};

export default ProductDetails;