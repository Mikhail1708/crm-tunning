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

// Форматирование скидки для отображения
export const formatDiscount = (percent: number): string => {
  if (percent <= 0) return '';
  if (percent % 1 === 0) return `${percent}%`;
  return `${percent.toFixed(1)}%`;
};

// 🆕 Форматирование телефона
export const formatPhone = (value: string): string => {
  // Удаляем все нецифровые символы
  const cleaned = value.replace(/\D/g, '');
  
  // Если пустая строка, возвращаем как есть
  if (!cleaned) return value;
  
  // Ограничиваем длину 11 цифрами (для российских номеров)
  const limited = cleaned.slice(0, 11);
  
  // Форматируем в зависимости от длины
  if (limited.length === 11) {
    // +7 (XXX) XXX-XX-XX
    return `+7 (${limited.slice(1, 4)}) ${limited.slice(4, 7)}-${limited.slice(7, 9)}-${limited.slice(9, 11)}`;
  } else if (limited.length === 10) {
    // Для номеров без +7: XXX-XXX-XX-XX
    return `${limited.slice(0, 3)}-${limited.slice(3, 6)}-${limited.slice(6, 8)}-${limited.slice(8, 10)}`;
  } else if (limited.length >= 7) {
    // Частичное форматирование
    const part1 = limited.slice(0, 3);
    const part2 = limited.slice(3, 6);
    const part3 = limited.slice(6);
    if (part3) {
      return `${part1}-${part2}-${part3}`;
    }
    if (part2) {
      return `${part1}-${part2}`;
    }
    return part1;
  }
  
  // Возвращаем исходную строку, если не подходит под формат
  return value;
};

// 🆕 Очистка телефона от форматирования (только цифры)
export const cleanPhone = (phone: string): string => {
  return phone.replace(/\D/g, '');
};

// 🆕 Валидация телефона (российский формат)
export const isValidPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/\D/g, '');
  // Российские номера: 11 цифр, начинается на 7 или 8
  return cleaned.length === 11 && (cleaned.startsWith('7') || cleaned.startsWith('8'));
};