// frontend/src/components/ui/OrderStatusBadge.tsx
import React from 'react';

export type OrderStatus = 'ordered' | 'assembling' | 'shipped';

interface OrderStatusBadgeProps {
  status: OrderStatus;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
}

const statusConfig: Record<OrderStatus, { label: string; icon: string; color: string }> = {
  ordered: { label: 'Оформлен', icon: '📋', color: 'blue' },
  assembling: { label: 'Собирается', icon: '🔧', color: 'yellow' },
  shipped: { label: 'Отправлен', icon: '🚚', color: 'green' }
};

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ 
  status, 
  size = 'md',
  showIcon = true 
}) => {
  const config = statusConfig[status];
  
  const sizeClasses = {
    sm: 'text-xs px-2 py-0.5',
    md: 'text-sm px-2.5 py-1',
    lg: 'text-base px-3 py-1.5'
  };
  
  const colorClasses = {
    blue: 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400',
    yellow: 'bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400',
    green: 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-400'
  };
  
  return (
    <span className={`inline-flex items-center gap-1 rounded-full font-medium ${sizeClasses[size]} ${colorClasses[config.color]}`}>
      {showIcon && <span>{config.icon}</span>}
      {config.label}
    </span>
  );
};