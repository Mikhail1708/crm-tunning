// frontend/src/components/ProductBasicForm.tsx
import React, { memo } from 'react';
import { Input } from './ui/Input';

interface ProductBasicFormProps {
  name: string;
  article: string;
  cost_price: number | string;
  retail_price: number | string;
  stock: number | string;
  min_stock: number | string;
  onChange: (field: string, value: any) => void;
}

export const ProductBasicForm = memo(({ 
  name, 
  article, 
  cost_price, 
  retail_price, 
  stock, 
  min_stock, 
  onChange 
}: ProductBasicFormProps) => {
  return (
    <>
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Название товара"
          value={name}
          onChange={(e) => onChange('name', e.target.value)}
          required
          placeholder="Введите название"
        />
        <Input
          label="Артикул"
          value={article}
          onChange={(e) => onChange('article', e.target.value)}
          required
          placeholder="Уникальный артикул"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Себестоимость (₽)"
          type="number"
          value={cost_price}
          onChange={(e) => onChange('cost_price', e.target.value)}
          required
          placeholder="0"
          step="0.01"
        />
        <Input
          label="Розничная цена (₽)"
          type="number"
          value={retail_price}
          onChange={(e) => onChange('retail_price', e.target.value)}
          required
          placeholder="0"
          step="0.01"
        />
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Остаток на складе"
          type="number"
          value={stock}
          onChange={(e) => onChange('stock', e.target.value)}
          required
          placeholder="0"
        />
        <Input
          label="Минимальный остаток"
          type="number"
          value={min_stock}
          onChange={(e) => onChange('min_stock', e.target.value)}
          required
          placeholder="5"
        />
      </div>
    </>
  );
});

ProductBasicForm.displayName = 'ProductBasicForm';