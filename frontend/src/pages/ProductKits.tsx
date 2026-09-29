import React, { useEffect, useMemo, useState } from 'react';
import { PackagePlus, Plus, Search, Trash2, Edit, X, Minus, Package, Loader } from 'lucide-react';
import toast from 'react-hot-toast';
import { productKitsApi, ProductKit } from '../api/productKits';
import { productsApi } from '../api/products';
import { categoriesApi } from '../api/categories';
import { Product, Category } from '../types';
import { formatPrice } from '../utils/formatters';

type DraftItem = { product: Product; quantity: number };

export const ProductKits: React.FC = () => {
  const [kits, setKits] = useState<ProductKit[]>([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState<ProductKit | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [article, setArticle] = useState('');
  const [categoryId, setCategoryId] = useState<number | ''>('');
  const [description, setDescription] = useState('');
  const [items, setItems] = useState<DraftItem[]>([]);
  const [productSearch, setProductSearch] = useState('');
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | ''>('');
  const [stockFilter, setStockFilter] = useState<'all' | 'in' | 'low' | 'out'>('all');
  const [categories, setCategories] = useState<Category[]>([]);
  const [productResults, setProductResults] = useState<Product[]>([]);
  const [searching, setSearching] = useState(false);
  const [saving, setSaving] = useState(false);

  const loadKits = async () => {
    try { setLoading(true); setKits((await productKitsApi.getAll()).data); }
    catch { toast.error('Не удалось загрузить комплекты'); }
    finally { setLoading(false); }
  };
  useEffect(() => { void loadKits(); }, []);

  useEffect(() => {
    categoriesApi.getAll()
      .then(response => setCategories(response.data))
      .catch(() => setCategories([]));
  }, []);

  useEffect(() => {
    if (!modalOpen) return;
    const timer = setTimeout(async () => {
      try {
        setSearching(true);
        const response = await productsApi.getAll({
          search: productSearch,
          searchScope: 'basic',
          categoryId: selectedCategoryId === '' ? undefined : selectedCategoryId,
          stockStatus: stockFilter === 'all' ? undefined : stockFilter,
          page: 1,
          limit: 50,
          excludeKits: true
        });
        setProductResults(response.data);
      } catch { setProductResults([]); }
      finally { setSearching(false); }
    }, 200);
    return () => clearTimeout(timer);
  }, [productSearch, selectedCategoryId, stockFilter, modalOpen]);

  const resetProductFilters = () => { setProductSearch(''); setSelectedCategoryId(''); setStockFilter('all'); };
  const openCreate = () => { setEditing(null); setName(''); setArticle(''); setCategoryId(''); setDescription(''); setItems([]); resetProductFilters(); setModalOpen(true); };
  const openEdit = (kit: ProductKit) => {
    setEditing(kit); setName(kit.product.name); setArticle(kit.product.article || ''); setCategoryId(kit.product.categoryIds?.[0] || ''); setDescription(kit.product.description || '');
    setItems(kit.items.map(i => ({ product: i.product, quantity: i.quantity })));
    resetProductFilters(); setModalOpen(true);
  };
  const addProduct = (product: Product) => {
    if (items.some(i => i.product.id === product.id)) { toast.error('Этот товар уже есть в комплекте'); return; }
    setItems(prev => [...prev, { product, quantity: 1 }]);
  };
  const changeQty = (productId: number, quantity: number) => setItems(prev => prev.map(i => i.product.id === productId ? { ...i, quantity: Math.max(1, quantity) } : i));
  const removeItem = (productId: number) => setItems(prev => prev.filter(i => i.product.id !== productId));

  const totals = useMemo(() => items.reduce((acc, i) => ({ cost: acc.cost + i.product.cost_price * i.quantity, retail: acc.retail + i.product.retail_price * i.quantity, units: acc.units + i.quantity }), { cost: 0, retail: 0, units: 0 }), [items]);

  const save = async () => {
    if (!name.trim()) { toast.error('Введите название комплекта'); return; }
    if (!article.trim()) { toast.error('Введите артикул комплекта'); return; }
    if (!categoryId) { toast.error('Выберите категорию комплекта'); return; }
    if (!items.length) { toast.error('Добавьте хотя бы один товар'); return; }
    try {
      setSaving(true);
      const payload = { name: name.trim(), article: article.trim(), categoryId: Number(categoryId), description: description.trim(), items: items.map(i => ({ productId: i.product.id, quantity: i.quantity })) };
      if (editing) await productKitsApi.update(editing.id, payload); else await productKitsApi.create(payload);
      toast.success(editing ? 'Комплект обновлён' : 'Комплект создан'); setModalOpen(false); await loadKits();
    } catch (e: any) { toast.error(e?.response?.data?.error || 'Ошибка сохранения комплекта'); }
    finally { setSaving(false); }
  };

  const removeKit = async (kit: ProductKit) => {
    if (!confirm(`Удалить комплект «${kit.product.name}»? Товары со склада удалены не будут.`)) return;
    try { await productKitsApi.delete(kit.id); toast.success('Комплект удалён'); await loadKits(); }
    catch { toast.error('Ошибка удаления комплекта'); }
  };

  return <div className="space-y-6 animate-fade-in">
    <div className="flex items-center justify-between gap-4">
      <div><h1 className="text-3xl font-bold text-gray-900 dark:text-white">Комплекты</h1><p className="text-gray-500 mt-1">Конструктор товаров-комплектов. Цена и себестоимость считаются автоматически из состава</p></div>
      <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-600 text-white hover:bg-green-700"><Plus size={18}/>Создать комплект</button>
    </div>
    {loading ? <div className="py-20 flex justify-center"><Loader className="animate-spin"/></div> : kits.length === 0 ? <div className="bg-white dark:bg-dark-900 rounded-xl border p-12 text-center"><PackagePlus size={48} className="mx-auto mb-3 text-gray-400"/><p className="font-medium">Комплектов пока нет</p><p className="text-sm text-gray-500">Создай первый товар-комплект из существующих товаров</p></div> :
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{kits.map(kit => {
        const cost = kit.items.reduce((s,i)=>s+i.product.cost_price*i.quantity,0); const retail = kit.items.reduce((s,i)=>s+i.product.retail_price*i.quantity,0);
        return <div key={kit.id} className="bg-white dark:bg-dark-900 rounded-xl border border-gray-200 dark:border-dark-700 p-5">
          <div className="flex justify-between gap-4"><div><h2 className="text-lg font-semibold">{kit.product.name}</h2><p className="text-xs text-gray-400 mt-0.5">{kit.product.article}</p>{kit.product.description && <p className="text-sm text-gray-500 mt-1">{kit.product.description}</p>}</div><div className="flex gap-1"><button onClick={()=>openEdit(kit)} className="p-2 hover:bg-gray-100 rounded-lg"><Edit size={18}/></button><button onClick={()=>void removeKit(kit)} className="p-2 hover:bg-red-50 text-red-600 rounded-lg"><Trash2 size={18}/></button></div></div>
          <div className="mt-4 space-y-1">{kit.items.map(i=><div key={i.id} className="flex justify-between text-sm"><span>{i.product.name} <span className="text-gray-400">{i.product.article ? `(${i.product.article})` : ''}</span></span><b>×{i.quantity}</b></div>)}</div>
          <div className="mt-4 pt-3 border-t text-sm flex justify-between"><span>{kit.items.length} поз. / {kit.items.reduce((s,i)=>s+i.quantity,0)} ед.</span><span>Себест. <b>{formatPrice(cost)}</b> · Розница <b>{formatPrice(retail)}</b></span></div>
        </div>})}</div>}

    {modalOpen && <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4" onMouseDown={e=>{if(e.target===e.currentTarget)setModalOpen(false)}}>
      <div className="bg-white dark:bg-dark-900 rounded-xl shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
        <div className="p-5 border-b flex justify-between items-center"><h2 className="text-xl font-semibold">{editing ? 'Редактировать комплект' : 'Новый комплект'}</h2><button onClick={()=>setModalOpen(false)}><X/></button></div>
        <div className="p-5 space-y-5">
          <div className="grid md:grid-cols-2 gap-4">
            <div><label className="text-sm font-medium">Название товара-комплекта</label><input value={name} onChange={e=>setName(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" placeholder="SWAP KIT LRVQ35"/></div>
            <div><label className="text-sm font-medium">Артикул</label><input value={article} onChange={e=>setArticle(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" placeholder="SWAP-LRVQ35"/></div>
            <div><label className="text-sm font-medium">Категория товара</label><select value={categoryId} onChange={e=>setCategoryId(e.target.value?Number(e.target.value):'')} className="mt-1 w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-900"><option value="">Выберите категорию</option>{categories.map(c=><option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
            <div><label className="text-sm font-medium">Описание</label><input value={description} onChange={e=>setDescription(e.target.value)} className="mt-1 w-full px-3 py-2 border rounded-lg" placeholder="Необязательно"/></div>
          </div>
          <div className="grid md:grid-cols-2 gap-5">
            <div>
              <h3 className="font-medium mb-2">Добавить товар</h3>
              <div className="space-y-2">
                <div className="relative"><Search size={16} className="absolute left-3 top-3 text-gray-400"/><input value={productSearch} onChange={e=>setProductSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 border rounded-lg" placeholder="Название или артикул"/></div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <select value={selectedCategoryId} onChange={e=>setSelectedCategoryId(e.target.value ? Number(e.target.value) : '')} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-900">
                    <option value="">Все категории</option>
                    {categories.map(category => <option key={category.id} value={category.id}>{category.name}</option>)}
                  </select>
                  <select value={stockFilter} onChange={e=>setStockFilter(e.target.value as 'all' | 'in' | 'low' | 'out')} className="w-full px-3 py-2 border rounded-lg bg-white dark:bg-dark-900">
                    <option value="all">Любой остаток</option>
                    <option value="in">В наличии</option>
                    <option value="low">Мало на складе</option>
                    <option value="out">Нет в наличии</option>
                  </select>
                </div>
              </div>
              <div className="mt-2 border rounded-lg max-h-72 overflow-y-auto">
                {searching ? <div className="p-4 text-center">Загрузка...</div> : productResults.length === 0 ? <div className="p-5 text-center text-sm text-gray-400">По выбранным фильтрам товаров нет</div> : productResults.map(p=><button key={p.id} onClick={()=>addProduct(p)} disabled={items.some(i=>i.product.id===p.id)} className="w-full p-3 text-left border-b last:border-b-0 hover:bg-gray-50 disabled:opacity-40"><div className="font-medium text-sm">{p.name}</div><div className="text-xs text-gray-500">{p.article || 'Без артикула'} · остаток {p.stock} · {formatPrice(p.retail_price)}</div></button>)}
              </div>
            </div>
            <div><h3 className="font-medium mb-2">Состав комплекта</h3>{items.length===0?<div className="border rounded-lg p-8 text-center text-gray-400"><Package className="mx-auto mb-2"/>Товары не выбраны</div>:<div className="space-y-2">{items.map(i=><div key={i.product.id} className="border rounded-lg p-3 flex items-center gap-3"><div className="flex-1 min-w-0"><div className="font-medium text-sm truncate">{i.product.name}</div><div className="text-xs text-gray-500">остаток {i.product.stock}</div></div><div className="flex items-center gap-1"><button onClick={()=>changeQty(i.product.id,i.quantity-1)} className="p-1 border rounded"><Minus size={14}/></button><input type="number" min="1" value={i.quantity} onChange={e=>changeQty(i.product.id,Number(e.target.value)||1)} className="w-14 text-center border rounded py-1"/><button onClick={()=>changeQty(i.product.id,i.quantity+1)} className="p-1 border rounded"><Plus size={14}/></button></div><button onClick={()=>removeItem(i.product.id)} className="text-red-500"><Trash2 size={17}/></button></div>)}</div>}</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-4 flex flex-wrap gap-6 text-sm"><span>Позиций: <b>{items.length}</b></span><span>Единиц: <b>{totals.units}</b></span><span>Себестоимость: <b>{formatPrice(totals.cost)}</b></span><span>Розничная сумма: <b>{formatPrice(totals.retail)}</b></span></div>
        </div>
        <div className="p-5 border-t flex justify-end gap-2"><button onClick={()=>setModalOpen(false)} className="px-4 py-2 border rounded-lg">Отмена</button><button onClick={()=>void save()} disabled={saving} className="px-4 py-2 bg-green-600 text-white rounded-lg disabled:opacity-50">{saving?'Сохранение...':'Сохранить комплект'}</button></div>
      </div>
    </div>}
  </div>;
};
