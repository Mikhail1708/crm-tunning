// frontend/src/components/ui/OrderStatusSelect.tsx
import React, { useState, useEffect, useRef } from 'react';
import { OrderStatus } from '../../types';
import { OrderStatusBadge } from './OrderStatusBadge';
import { ChevronDown, Check } from 'lucide-react';

interface OrderStatusSelectProps {
  orderId: number;
  currentStatus: OrderStatus;
  onStatusChange: (orderId: number, newStatus: OrderStatus) => void;
  size?: 'sm' | 'md' | 'lg';
}

const statusOptions: { value: OrderStatus; label: string; description: string }[] = [
  { value: 'ordered', label: 'Оформлен', description: 'Заказ принят, ожидает обработки' },
  { value: 'assembling', label: 'Собирается', description: 'Идет сборка и подготовка заказа' },
  { value: 'shipped', label: 'Отправлен', description: 'Заказ передан клиенту' }
];

export const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({ 
  orderId, 
  currentStatus, 
  onStatusChange,
  size = 'md'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleSelect = (status: OrderStatus) => {
    onStatusChange(orderId, status);
    setIsOpen(false);
  };

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 hover:opacity-80 transition-opacity"
      >
        <OrderStatusBadge status={currentStatus} size={size} />
        <ChevronDown size={size === 'sm' ? 12 : 14} className="text-gray-400" />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-64 bg-white rounded-lg shadow-lg border border-gray-200 z-50">
          <div className="p-2">
            <div className="text-xs font-medium text-gray-500 px-3 py-2 border-b border-gray-100">
              Изменить статус заказа
            </div>
            {statusOptions.map((option) => (
              <button
                key={option.value}
                onClick={() => handleSelect(option.value)}
                className={`w-full text-left px-3 py-2 rounded-lg transition-colors flex items-center justify-between group ${
                  currentStatus === option.value
                    ? 'bg-primary-50 text-primary-700'
                    : 'hover:bg-gray-50 text-gray-700'
                }`}
              >
                <div>
                  <div className="font-medium text-sm">{option.label}</div>
                  <div className="text-xs text-gray-400">{option.description}</div>
                </div>
                {currentStatus === option.value && (
                  <Check size={16} className="text-primary-600" />
                )}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};