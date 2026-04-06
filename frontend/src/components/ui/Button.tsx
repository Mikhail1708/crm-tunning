// frontend/src/components/ui/Button.tsx
import React, { ButtonHTMLAttributes, ReactNode } from 'react';
import { LucideIcon } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'success' | 'danger' | 'outline' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode;
  variant?: ButtonVariant;
  size?: ButtonSize;
  icon?: LucideIcon;
  loading?: boolean;
  fullWidth?: boolean;
}

const variants: Record<ButtonVariant, string> = {
  // primary теперь черный вместо синего
  primary: 'bg-primary-800 text-white hover:bg-primary-900 dark:bg-primary-200 dark:text-primary-900 dark:hover:bg-primary-100 shadow-md hover:shadow-lg',
  secondary: 'bg-gray-500 text-white hover:bg-gray-600 dark:bg-gray-600 dark:hover:bg-gray-500 shadow-md',
  success: 'bg-green-600 text-white hover:bg-green-700 shadow-md',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md',
  outline: 'border-2 border-primary-700 text-primary-700 hover:bg-primary-50 dark:border-primary-300 dark:text-primary-300 dark:hover:bg-primary-900/30',
  ghost: 'text-gray-700 bg-gray-100 hover:bg-gray-200 dark:text-gray-300 dark:bg-dark-800 dark:hover:bg-dark-700',
};

const sizes: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-sm',
  md: 'px-5 py-2.5 text-sm',
  lg: 'px-6 py-3 text-base',
};

export const Button: React.FC<ButtonProps> = ({ 
  children, 
  variant = 'primary', 
  size = 'md', 
  icon: Icon, 
  loading, 
  fullWidth,
  className = '',
  disabled,
  ...props 
}) => {
  return (
    <button
      className={`
        ${variants[variant]}
        ${sizes[size]}
        ${fullWidth ? 'w-full' : ''}
        rounded-lg font-semibold transition-all duration-200
        flex items-center justify-center gap-2
        disabled:opacity-50 disabled:cursor-not-allowed
        ${className}
      `}
      disabled={loading || disabled}
      {...props}
    >
      {loading ? (
        <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
      ) : (
        Icon && <Icon size={size === 'sm' ? 16 : 20} />
      )}
      {children}
    </button>
  );
};

export default Button;