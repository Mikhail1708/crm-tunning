// frontend/src/components/ui/Button.tsx
import React, { ButtonHTMLAttributes, ReactNode, ElementType } from 'react';
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
  primary: 'bg-primary-600 text-white hover:bg-primary-700 shadow-md hover:shadow-lg',
  secondary: 'bg-gray-600 text-white hover:bg-gray-700 shadow-md',
  success: 'bg-green-600 text-white hover:bg-green-700 shadow-md',
  danger: 'bg-red-600 text-white hover:bg-red-700 shadow-md',
  outline: 'border-2 border-primary-600 text-primary-600 hover:bg-primary-50',
  ghost: 'text-gray-700 bg-gray-100 hover:bg-gray-200',
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