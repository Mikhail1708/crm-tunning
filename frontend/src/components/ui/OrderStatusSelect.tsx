// frontend/src/components/ui/OrderStatusSelect.tsx
import React from 'react';
import { OrderStatus } from '../../types';
import { Package, Settings, Truck, Loader } from 'lucide-react';

interface OrderStatusSelectProps {
  orderId: number;
  currentStatus: OrderStatus;
  onStatusChange: (orderId: number, status: OrderStatus) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

const statusConfig: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string }> = {
  ordered: {
    label: 'Оформлен',
    icon: <Package size={16} />,
    color: 'blue'
  },
  assembling: {
    label: 'Собирается',
    icon: <Settings size={16} />,
    color: 'yellow'
  },
  shipped: {
    label: 'Отправлен',
    icon: <Truck size={16} />,
    color: 'green'
  }
};

export const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({ 
  orderId, 
  currentStatus, 
  onStatusChange,
  size = 'md',
  disabled = false
}) => {
  const handleChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    onStatusChange(orderId, e.target.value as OrderStatus);
  };

  const sizeClasses = {
    sm: 'px-2 py-1 text-xs',
    md: 'px-3 py-1.5 text-sm',
    lg: 'px-4 py-2 text-base'
  };

  return (
    <div className="relative">
      <select
        value={currentStatus}
        onChange={handleChange}
        disabled={disabled}
        className={`
          ${sizeClasses[size]}
          rounded-lg border-2 font-medium cursor-pointer
          transition-all duration-200 appearance-none pr-8
          ${disabled ? 'opacity-50 cursor-not-allowed' : 'hover:shadow-md'}
          ${currentStatus === 'ordered' && 'border-blue-300 bg-blue-50 text-blue-700'}
          ${currentStatus === 'assembling' && 'border-yellow-300 bg-yellow-50 text-yellow-700'}
          ${currentStatus === 'shipped' && 'border-green-300 bg-green-50 text-green-700'}
        `}
      >
        <option value="ordered">Оформлен</option>
        <option value="assembling">Собирается</option>
        <option value="shipped">Отправлен</option>
      </select>
      {disabled && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Loader size={14} className="animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};