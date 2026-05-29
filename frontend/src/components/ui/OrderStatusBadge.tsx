// frontend/src/components/ui/OrderStatusBadge.tsx
import React from 'react';
import { OrderStatus } from '../../types';
import { Package, Settings, Truck } from 'lucide-react';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusConfig: Record<OrderStatus, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  ordered: {
    label: 'Оформлен',
    icon: <Package size={14} />,
    color: 'text-blue-700 dark:text-blue-400',
    bg: 'bg-blue-100 dark:bg-blue-900/30'
  },
  assembling: {
    label: 'Собирается',
    icon: <Settings size={14} />,
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  shipped: {
    label: 'Отправлен',
    icon: <Truck size={14} />,
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30'
  }
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs',
  md: 'px-2.5 py-1 text-sm',
  lg: 'px-3 py-1.5 text-base'
};

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ 
  status, 
  size = 'md', 
  showIcon = true 
}) => {
  const config = statusConfig[status];
  
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full font-medium ${sizeClasses[size]} ${config.bg} ${config.color}`}>
      {showIcon && config.icon}
      {config.label}
    </span>
  );
};