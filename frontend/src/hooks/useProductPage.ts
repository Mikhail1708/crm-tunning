import { useCallback, useEffect, useState } from 'react';
import { GetProductsParams, productsApi } from '../api/products';
import { Product } from '../types';
import toast from 'react-hot-toast';

const emptySummary = { total: 0, totalStock: 0, totalValue: 0, lowStock: 0 };

// A filter change starts at page one. Older in-flight responses cannot replace it.
export function useProductPage(filters: GetProductsParams, enabled = true, withSummary = false, limit = 50) {
  const key = JSON.stringify(filters);
  const [position, setPosition] = useState({ key, page: 1 });
  const page = position.key === key ? position.page : 1;
  const [products, setProducts] = useState<Product[]>([]);
  const [total, setTotal] = useState(0);
  const [summary, setSummary] = useState(emptySummary);
  const [loading, setLoading] = useState(false);
  const [revision, setRevision] = useState(0);
  const reload = useCallback(() => { setRevision(value => value + 1); }, []);
  const setPage = useCallback((next: number) => setPosition({ key, page: Math.max(1, next) }), [key]);

  useEffect(() => {
    if (!enabled) return;
    let active = true;
    setLoading(true);
    const params: GetProductsParams = JSON.parse(key);
    const timer = setTimeout(() => { Promise.all([
      productsApi.getAll({ ...params, page, limit }),
      withSummary ? productsApi.getSummary(params) : Promise.resolve(null),
    ]).then(([response, totals]) => {
      if (!active) return;
      const count = Number(response.headers['x-total-count']);
      if (!Number.isSafeInteger(count) || count < 0) throw new Error('Invalid product count');
      if (page > 1 && response.data.length === 0) {
        setPosition({ key, page: Math.max(1, Math.ceil(count / limit)) });
        return;
      }
      setProducts(response.data);
      setTotal(count);
      if (totals) setSummary(totals.data);
    }).catch(() => {
      if (!active) return;
      setProducts([]);
      setTotal(0);
      setSummary(emptySummary);
      toast.error('Ошибка загрузки товаров');
    }).finally(() => { if (active) setLoading(false); }); }, 200);
    return () => { active = false; clearTimeout(timer); };
  }, [key, page, limit, enabled, withSummary, revision]);

  return { products: enabled ? products : [], total: enabled ? total : 0, summary, loading, page, setPage, reload };
}
