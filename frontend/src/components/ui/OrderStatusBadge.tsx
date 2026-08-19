// frontend/src/components/ui/OrderStatusBadge.tsx
import React from 'react';
import { OrderStatus } from '../../types';
import { Package, Settings, Truck, Clock, CheckCircle, XCircle } from 'lucide-react';

// ✅ РАСШИРЯЕМ ТИП ДЛЯ ВСЕХ ВОЗМОЖНЫХ СТАТУСОВ
type StatusType = OrderStatus | 'pending' | 'paid' | 'cancelled' | 'completed' | string;

interface OrderStatusBadgeProps {
  status: StatusType;
  size?: 'sm' | 'md' | 'lg';
  showIcon?: boolean;
  className?: string;
}

// ✅ КОНФИГ ДЛЯ ВСЕХ СТАТУСОВ
const statusConfig: Record<string, { label: string; icon: React.ReactNode; color: string; bg: string }> = {
  // Статусы CRM
  confirmed: {
    label: 'Подтверждён',
    icon: <CheckCircle size={14} />,
    color: 'text-indigo-700 dark:text-indigo-400',
    bg: 'bg-indigo-100 dark:bg-indigo-900/30'
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
  },
  completed: {
    label: 'Выполнен',
    icon: <CheckCircle size={14} />,
    color: 'text-emerald-700 dark:text-emerald-400',
    bg: 'bg-emerald-100 dark:bg-emerald-900/30'
  },
  cancelled: {
    label: 'Отменён',
    icon: <XCircle size={14} />,
    color: 'text-red-700 dark:text-red-400',
    bg: 'bg-red-100 dark:bg-red-900/30'
  },
  // Статусы сайта
  pending: {
    label: 'Ожидает оплаты',
    icon: <Clock size={14} />,
    color: 'text-yellow-700 dark:text-yellow-400',
    bg: 'bg-yellow-100 dark:bg-yellow-900/30'
  },
  paid: {
    label: 'Оплачен',
    icon: <CheckCircle size={14} />,
    color: 'text-green-700 dark:text-green-400',
    bg: 'bg-green-100 dark:bg-green-900/30'
  }
};

// ✅ ФОЛБЭК ДЛЯ НЕИЗВЕСТНЫХ СТАТУСОВ
const defaultConfig = {
  label: 'Неизвестно',
  icon: <Package size={14} />,
  color: 'text-gray-700 dark:text-gray-400',
  bg: 'bg-gray-100 dark:bg-gray-800/50'
};

const sizeClasses = {
  sm: 'px-2 py-0.5 text-xs gap-1',
  md: 'px-2.5 py-1 text-sm gap-1.5',
  lg: 'px-3 py-1.5 text-base gap-2'
};

export const OrderStatusBadge: React.FC<OrderStatusBadgeProps> = ({ 
  status, 
  size = 'md', 
  showIcon = true,
  className = ''
}) => {
  // ✅ БЕЗОПАСНОЕ ПОЛУЧЕНИЕ КОНФИГА
  const config = statusConfig[status] || defaultConfig;
  
  return (
    <span className={`inline-flex items-center rounded-full font-medium ${sizeClasses[size]} ${config.bg} ${config.color} ${className}`}>
      {showIcon && config.icon}
      {config.label}
    </span>
  );
};

export default OrderStatusBadge;
