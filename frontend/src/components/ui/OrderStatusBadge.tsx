// frontend/src/components/ui/OrderStatusBadge.tsx
import React from 'react';
import { OrderStatus } from '../../types';
import { Package, Settings, Truck, Clock } from 'lucide-react';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

const statusConfig: Record<OrderStatus, { label: string; color: string; icon: React.ElementType }> = {
  ordered: {
    label: 'Оформлен',
    color: 'bg-blue-100 text-blue-700 border-blue-200',
    icon: Clock
  },
  assembling: {
    label: 'Собирается',
    color: 'bg-yellow-100 text-yellow-700 border-yellow-200',
    icon: Settings
  },
  shipped: {
    label: 'Отправлен',
    color: 'bg-green-100 text-green-700 border-green-200',
    icon: Truck
  }
};

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ 
  status, 
  size = 'md',
  showIcon = true,
  className = ''
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;
  
  const sizeClasses = {
    sm: 'px-2 py-0.5 text-xs gap-1',
    md: 'px-2.5 py-1 text-sm gap-1.5',
    lg: 'px-3 py-1.5 text-base gap-2'
  };
  
  const iconSizes = {
    sm: 12,
    md: 14,
    lg: 18
  };
  
  return (
    <span className={`inline-flex items-center rounded-full border font-medium ${sizeClasses[size]} ${config.color} ${className}`}>
      {showIcon && <Icon size={iconSizes[size]} />}
      {config.label}
    </span>
  );
};