// frontend/src/components/ui/OrderStatusSelect.tsx
import React from 'react';

export type OrderStatus = 'ordered' | 'assembling' | 'shipped';

interface OrderStatusSelectProps {
  orderId: number;
  currentStatus: OrderStatus;
  onStatusChange: (orderId: number, newStatus: OrderStatus, e: React.MouseEvent) => void;  // 🆕 добавили e
  size?: 'sm' | 'md';
  isLoading?: boolean;
}

export const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({ 
  orderId, 
  currentStatus, 
  onStatusChange, 
  size = 'md',
  isLoading = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    // Создаем синтетическое событие мыши для остановки всплытия
    const mouseEvent = new MouseEvent('click', { bubbles: true });
    mouseEvent.stopPropagation();
    onStatusChange(orderId, e.target.value as OrderStatus, e as any);
  };

  return (
    <select
      value={currentStatus}
      onChange={handleChange}
      disabled={isLoading}
      onClick={(e) => e.stopPropagation()}  // 🆕 останавливаем всплытие
      className={`
        ${size === 'sm' ? 'text-xs px-2 py-1' : 'text-sm px-3 py-1.5'}
        rounded-lg border border-gray-300 dark:border-gray-600
        bg-white dark:bg-gray-700
        text-gray-700 dark:text-gray-200
        focus:ring-2 focus:ring-primary-500 focus:border-transparent
        transition-colors cursor-pointer
        ${isLoading ? 'opacity-50 cursor-not-allowed' : ''}
      `}
    >
      <option value="ordered">Оформлен</option>
      <option value="assembling">Собирается</option>
      <option value="shipped">Отправлен</option>
    </select>
  );
};