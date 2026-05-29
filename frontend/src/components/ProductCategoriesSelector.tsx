// frontend/src/components/ProductCategoriesSelector.tsx
import React, { memo } from 'react';
import { Layers } from 'lucide-react';
import { Category } from '../types';

interface ProductCategoriesSelectorProps {
  categories: Category[];
  selectedCategoryIds: number[];
  onChange: (categoryIds: number[]) => void;
}

export const ProductCategoriesSelector = memo(({ 
  categories, 
  selectedCategoryIds, 
  onChange 
}: ProductCategoriesSelectorProps) => {
  const handleToggleCategory = (categoryId: number, checked: boolean) => {
    const newCategoryIds = checked
      ? [...selectedCategoryIds, categoryId]
      : selectedCategoryIds.filter(id => id !== categoryId);
    onChange(newCategoryIds);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700 flex items-center gap-2">
        <Layers size={16} />
        Категории (можно выбрать несколько)
      </label>
      <div className="grid grid-cols-2 gap-2 max-h-48 overflow-y-auto p-2 border border-gray-200 rounded-xl">
        {categories.map(category => (
          <label key={category.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded-lg cursor-pointer">
            <input
              type="checkbox"
              value={category.id}
              checked={selectedCategoryIds.includes(category.id)}
              onChange={(e) => handleToggleCategory(category.id, e.target.checked)}
              className="w-4 h-4 text-primary-600 rounded border-gray-300 focus:ring-primary-500"
            />
            <span className="text-sm text-gray-700">
              {category.name}
              {category.fields && category.fields.length > 0 && (
                <span className="text-xs text-gray-400 ml-1">({category.fields.length} полей)</span>
              )}
            </span>
          </label>
        ))}
      </div>
      {categories.length === 0 && (
        <p className="text-xs text-yellow-600 mt-1">
          Нет категорий. Сначала создайте категорию в разделе "Категории"
        </p>
      )}
      {selectedCategoryIds.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {selectedCategoryIds.map(catId => {
            const cat = categories.find(c => c.id === catId);
            return cat ? (
              <span key={catId} className="px-2 py-1 text-xs rounded-full bg-primary-100 text-primary-700">
                {cat.name}
              </span>
            ) : null;
          })}
        </div>
      )}
    </div>
  );
});

ProductCategoriesSelector.displayName = 'ProductCategoriesSelector';