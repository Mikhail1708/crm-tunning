// frontend/src/utils/formatters.ts

export const formatPrice = (price: number): string => {
  return new Intl.NumberFormat('ru-RU', {
    style: 'currency',
    currency: 'RUB',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(price);
};

export const formatDate = (date: string | Date): string => {
  return new Date(date).toLocaleDateString('ru-RU', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatNumber = (num: number): string => {
  return new Intl.NumberFormat('ru-RU').format(num);
};

export const getMarginColor = (margin: number): string => {
  if (margin >= 50) return 'text-green-600';
  if (margin >= 25) return 'text-yellow-600';
  return 'text-red-600';
};

interface StockStatus {
  text: string;
  color: string;
  bg: string;
}

export const getStockStatus = (stock: number, minStock: number): StockStatus => {
  if (stock <= 0) return { text: 'Нет в наличии', color: 'text-red-600', bg: 'bg-red-50' };
  if (stock <= minStock) return { text: 'Мало', color: 'text-yellow-600', bg: 'bg-yellow-50' };
  return { text: 'В наличии', color: 'text-green-600', bg: 'bg-green-50' };
};