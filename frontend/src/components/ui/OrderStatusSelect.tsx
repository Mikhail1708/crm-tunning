import React from 'react';
import { OrderStatus } from '../../types';
import { Loader } from 'lucide-react';

interface OrderStatusSelectProps {
  orderId: number;
  currentStatus: OrderStatus;
  onStatusChange: (orderId: number, status: OrderStatus) => void;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
}

export const orderStatusLabels: Record<OrderStatus, string> = {
  confirmed: 'Подтверждён',
  assembling: 'Собирается',
  shipped: 'Отправлен',
  cancelled: 'Отменён',
};

const nextStatuses: Record<OrderStatus, readonly OrderStatus[]> = {
  confirmed: ['assembling', 'shipped', 'cancelled'],
  assembling: ['shipped', 'cancelled'],
  shipped: [],
  cancelled: [],
};

const statusClasses: Record<OrderStatus, string> = {
  confirmed: 'border-indigo-300 bg-indigo-50 text-indigo-800 dark:border-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300',
  assembling: 'border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-700 dark:bg-amber-950/50 dark:text-amber-300',
  shipped: 'border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/50 dark:text-emerald-300',
  cancelled: 'border-red-300 bg-red-50 text-red-800 dark:border-red-700 dark:bg-red-950/50 dark:text-red-300',
};

export const OrderStatusSelect: React.FC<OrderStatusSelectProps> = ({
  orderId,
  currentStatus,
  onStatusChange,
  size = 'md',
  disabled = false,
}) => {
  const choices = [currentStatus, ...nextStatuses[currentStatus]];
  const isTerminal = nextStatuses[currentStatus].length === 0;
  const sizeClasses = { sm: 'px-2 py-1 text-xs', md: 'px-3 py-1.5 text-sm', lg: 'px-4 py-2 text-base' };

  return (
    <div className="relative">
      <select
        value={currentStatus}
        onChange={(event) => onStatusChange(orderId, event.target.value as OrderStatus)}
        disabled={disabled || isTerminal}
        className={`${sizeClasses[size]} rounded-lg border-2 font-medium transition-all duration-200 pr-8
          ${(disabled || isTerminal) ? 'opacity-70 cursor-not-allowed' : 'cursor-pointer hover:shadow-md'}
          ${statusClasses[currentStatus]}`}
      >
        {choices.map((status) => (
          <option key={status} value={status}>{orderStatusLabels[status]}</option>
        ))}
      </select>
      {disabled && (
        <div className="absolute right-2 top-1/2 -translate-y-1/2">
          <Loader size={14} className="animate-spin text-gray-400" />
        </div>
      )}
    </div>
  );
};
