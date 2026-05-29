// backend/src/utils/validation.ts
import { Product } from '@prisma/client';

export interface SaleData {
  quantity: number;
  selling_price: number;
}

export const validateSale = (data: SaleData, product: Product): string[] => {
  const errors: string[] = [];
  
  if (!data.quantity || data.quantity <= 0) {
    errors.push('Количество должно быть больше 0');
  }
  
  if (data.quantity > product.stock) {
    errors.push(`Недостаточно товара на складе. Доступно: ${product.stock}`);
  }
  
  if (!data.selling_price || data.selling_price <= 0) {
    errors.push('Цена продажи должна быть больше 0');
  }
  
  if (data.selling_price < product.cost_price) {
    errors.push('Цена продажи не может быть ниже себестоимости');
  }
  
  return errors;
};

export const validatePhone = (phone: string): boolean => {
  const phoneRegex = /^(\+7|8)[\s\-]?\(?\d{3}\)?[\s\-]?\d{3}[\s\-]?\d{2}[\s\-]?\d{2}$/;
  return phoneRegex.test(phone);
};

export const formatPhone = (phone: string): string => {
  const digits = phone.replace(/\D/g, '');
  
  if (digits.length === 10) {
    return `+7 (${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6, 8)}-${digits.slice(8, 10)}`;
  }
  
  if (digits.length === 11 && digits[0] === '7') {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  
  if (digits.length === 11 && digits[0] === '8') {
    return `+7 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7, 9)}-${digits.slice(9, 11)}`;
  }
  
  return phone;
};