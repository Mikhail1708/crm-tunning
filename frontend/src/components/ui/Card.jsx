// frontend/src/components/ui/Card.jsx
import React from 'react';

export const Card = ({ children, className = '', hover = false }) => {
  return (
    <div className={`
      bg-white dark:bg-gray-800 rounded-2xl shadow-sm border border-gray-100 dark:border-gray-700
      ${hover ? 'hover:shadow-lg hover:scale-[1.02] transition-all duration-300' : ''}
      ${className}
    `}>
      {children}
    </div>
  );
};

export const CardHeader = ({ children, className = '' }) => (
  <div className={`p-6 border-b border-gray-100 dark:border-gray-700 ${className}`}>{children}</div>
);

export const CardBody = ({ children, className = '' }) => (
  <div className={`p-6 ${className}`}>{children}</div>
);

export const CardFooter = ({ children, className = '' }) => (
  <div className={`p-6 border-t border-gray-100 dark:border-gray-700 ${className}`}>{children}</div>
);

export default Card;