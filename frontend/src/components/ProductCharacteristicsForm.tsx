// frontend/src/components/ProductCharacteristicsForm.tsx
import React, { memo } from 'react';
import { Input } from './ui/Input';
import { Tag } from 'lucide-react';
import { CategoryField, ProductCharacteristic } from '../types';

interface ProductCharacteristicsFormProps {
  fields: CategoryField[];
  characteristics: ProductCharacteristic;
  onChange: (fieldId: number, value: string | number | string[]) => void;
}

export const ProductCharacteristicsForm = memo(({ 
  fields, 
  characteristics, 
  onChange 
}: ProductCharacteristicsFormProps) => {
  if (!fields.length) return null;

  const renderField = (field: CategoryField) => {
    const options = field.options ? JSON.parse(field.options as string) : [];
    const currentValue = characteristics[field.id] || 
      (field.fieldType === 'multiselect' ? [] : 
       field.fieldType === 'checkbox' ? false : '');

    switch (field.fieldType) {
      case 'select':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.name} {field.isRequired && <span className="text-red-500">*</span>}
            </label>
            <select
              value={currentValue as string}
              onChange={(e) => onChange(field.id, e.target.value)}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
              required={field.isRequired}
            >
              <option value="">Выберите {field.name.toLowerCase()}</option>
              {options.map((option: string) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
        );
        
      case 'multiselect':
        return (
          <div key={field.id} className="space-y-2">
            <label className="block text-sm font-medium text-gray-700">
              {field.name} {field.isRequired && <span className="text-red-500">*</span>}
            </label>
            <select
              multiple
              value={currentValue as string[]}
              onChange={(e) => {
                const values = Array.from(e.target.selectedOptions, option => option.value);
                onChange(field.id, values);
              }}
              className="w-full px-4 py-2 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent min-h-[100px]"
              required={field.isRequired}
              size={Math.min(options.length, 5)}
            >
              {options.map((option: string) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500">Удерживайте Ctrl для выбора нескольких вариантов</p>
          </div>
        );
        
      case 'number':
        return (
          <Input
            key={field.id}
            label={`${field.name} ${field.isRequired ? '*' : ''}`}
            type="number"
            value={currentValue as string}
            onChange={(e) => onChange(field.id, e.target.value)}
            required={field.isRequired}
            placeholder={`Введите ${field.name.toLowerCase()}`}
          />
        );
        
      default:
        return (
          <Input
            key={field.id}
            label={`${field.name} ${field.isRequired ? '*' : ''}`}
            type="text"
            value={currentValue as string}
            onChange={(e) => onChange(field.id, e.target.value)}
            required={field.isRequired}
            placeholder={`Введите ${field.name.toLowerCase()}`}
          />
        );
    }
  };

  return (
    <div className="space-y-4 border-t border-gray-200 pt-4 mt-4">
      <h3 className="font-medium text-gray-900 flex items-center gap-2">
        <Tag size={18} className="text-primary-600" />
        Характеристики товара
      </h3>
      {fields.map(renderField)}
    </div>
  );
});

ProductCharacteristicsForm.displayName = 'ProductCharacteristicsForm';