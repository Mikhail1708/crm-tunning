// frontend/src/components/ui/Input.tsx
import React, { forwardRef, InputHTMLAttributes, TextareaHTMLAttributes } from 'react';
import { LucideIcon } from 'lucide-react';

type InputProps = {
  label?: string;
  error?: string;
  icon?: LucideIcon;
  multiline?: boolean;
  rows?: number;
  className?: string;
} & (
  | (InputHTMLAttributes<HTMLInputElement> & { multiline?: false })
  | (TextareaHTMLAttributes<HTMLTextAreaElement> & { multiline: true })
);

export const Input = forwardRef<HTMLInputElement | HTMLTextAreaElement, InputProps>(
  ({ 
    label, 
    error, 
    icon: Icon,
    className = '',
    multiline = false,
    rows = 3,
    ...props 
  }, ref) => {
    const inputClasses = `
      w-full px-4 py-2 rounded-xl border border-gray-200
      focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent
      transition-all duration-200
      ${Icon ? 'pl-10' : ''}
      ${error ? 'border-red-500 focus:ring-red-500' : ''}
      ${className}
    `;

    return (
      <div className="space-y-2">
        {label && (
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300">
            {label}
          </label>
        )}
        <div className="relative">
          {Icon && (
            <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
          )}
          {multiline ? (
            <textarea
              ref={ref as React.Ref<HTMLTextAreaElement>}
              rows={rows}
              className={inputClasses}
              {...(props as TextareaHTMLAttributes<HTMLTextAreaElement>)}
            />
          ) : (
            <input
              ref={ref as React.Ref<HTMLInputElement>}
              className={inputClasses}
              {...(props as InputHTMLAttributes<HTMLInputElement>)}
            />
          )}
        </div>
        {error && (
          <p className="text-sm text-red-500">{error}</p>
        )}
      </div>
    );
  }
);

Input.displayName = 'Input';

export default Input;