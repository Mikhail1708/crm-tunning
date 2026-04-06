// frontend/src/components/ui/Table.tsx
import React, { ReactNode, TableHTMLAttributes } from 'react';

interface TableProps extends TableHTMLAttributes<HTMLTableElement> {
  children: ReactNode;
  className?: string;
}

interface TableSectionProps {
  children: ReactNode;
}

interface TableRowProps extends React.HTMLAttributes<HTMLTableRowElement> {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}

export const Table: React.FC<TableProps> = ({ children, className = '', ...props }) => {
  return (
    <div className="overflow-x-auto">
      <table className={`min-w-full divide-y divide-gray-200 dark:divide-dark-700 ${className}`} {...props}>
        {children}
      </table>
    </div>
  );
};

export const Thead: React.FC<TableSectionProps> = ({ children }) => {
  return <thead className="bg-gray-50 dark:bg-dark-800">{children}</thead>;
};

export const Tbody: React.FC<TableSectionProps> = ({ children }) => {
  return <tbody className="bg-white dark:bg-dark-900 divide-y divide-gray-200 dark:divide-dark-800">{children}</tbody>;
};

export const Tr: React.FC<TableRowProps> = ({ children, className = '', onClick, ...props }) => {
  return (
    <tr 
      className={`hover:bg-gray-50 dark:hover:bg-dark-800 transition-colors ${className}`} 
      onClick={onClick}
      style={{ cursor: onClick ? 'pointer' : 'default' }}
      {...props}
    >
      {children}
    </tr>
  );
};

export const Th: React.FC<TableSectionProps & { className?: string }> = ({ children, className = '' }) => {
  return (
    <th className={`px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider ${className}`}>
      {children}
    </th>
  );
};

export const Td: React.FC<TableSectionProps & { className?: string }> = ({ children, className = '' }) => {
  return (
    <td className={`px-6 py-4 whitespace-nowrap text-sm text-gray-500 dark:text-gray-400 ${className}`}>
      {children}
    </td>
  );
};