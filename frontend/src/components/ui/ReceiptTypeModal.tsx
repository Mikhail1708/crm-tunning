// frontend/src/components/ui/ReceiptTypeModal.tsx
import React from 'react';
import { X, User, Building2 } from 'lucide-react';
import { Button } from './Button';

interface ReceiptTypeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSelect: (type: 'individual' | 'legal') => void;
}

export const ReceiptTypeModal: React.FC<ReceiptTypeModalProps> = ({
  isOpen,
  onClose,
  onSelect,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Выберите тип чека</h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-3">
          <button
            onClick={() => onSelect('individual')}
            className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all"
          >
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <User size={20} className="text-blue-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900">Физическое лицо</div>
              <div className="text-sm text-gray-500">Чек для физического лица</div>
            </div>
          </button>

          <button
            onClick={() => onSelect('legal')}
            className="w-full flex items-center gap-4 p-4 border border-gray-200 rounded-lg hover:border-primary-300 hover:bg-primary-50 transition-all"
          >
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <Building2 size={20} className="text-purple-600" />
            </div>
            <div className="flex-1 text-left">
              <div className="font-medium text-gray-900">Юридическое лицо</div>
              <div className="text-sm text-gray-500">Счет-фактура с реквизитами</div>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};