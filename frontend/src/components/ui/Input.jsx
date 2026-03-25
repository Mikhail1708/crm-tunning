// frontend/src/components/ui/Input.jsx
import React, { forwardRef } from 'react';

export const Input = forwardRef(({ 
  label, 
  error, 
  icon: Icon,  // Иконка должна быть компонентом, а не JSX элементом
  className = '',
  multiline,
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
        <label className="block text-sm font-medium text-gray-700">
          {label}
        </label>
      )}
      <div className="relative">
        {Icon && (
          <Icon className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
        )}
        {multiline ? (
          <textarea
            ref={ref}
            rows={rows}
            className={inputClasses}
            {...props}
          />
        ) : (
          <input
            ref={ref}
            className={inputClasses}
            {...props}
          />
        )}
      </div>
      {error && (
        <p className="text-sm text-red-500">{error}</p>
      )}
    </div>
  );
});

Input.displayName = 'Input';
export default Input;