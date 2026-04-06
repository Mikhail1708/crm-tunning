// frontend/src/components/ui/LegalEntityModal.tsx
import React, { useState } from 'react';
import { X, Building2, FileText, Hash, MapPin, CreditCard } from 'lucide-react';
import { Button } from './Button';

interface LegalEntityData {
  companyName: string;
  inn: string;
  kpp: string;
  legalAddress: string;
  bankName: string;
  bic: string;
  accountNumber: string;
}

interface LegalEntityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: LegalEntityData) => void;
}

export const LegalEntityModal: React.FC<LegalEntityModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
}) => {
  const [formData, setFormData] = useState<LegalEntityData>({
    companyName: '',
    inn: '',
    kpp: '',
    legalAddress: '',
    bankName: '',
    bic: '',
    accountNumber: '',
  });

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(formData);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setFormData(prev => ({
      ...prev,
      [e.target.name]: e.target.value,
    }));
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 animate-fade-in">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-lg mx-4 max-h-[90vh] overflow-y-auto animate-scale-up">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 sticky top-0 bg-white">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Building2 size={20} />
            Реквизиты организации
          </h2>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Наименование организации *
            </label>
            <input
              type="text"
              name="companyName"
              value={formData.companyName}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="ООО 'Ромашка'"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                ИНН *
              </label>
              <input
                type="text"
                name="inn"
                value={formData.inn}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="1234567890"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                КПП
              </label>
              <input
                type="text"
                name="kpp"
                value={formData.kpp}
                onChange={handleChange}
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="123456789"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Юридический адрес *
            </label>
            <input
              type="text"
              name="legalAddress"
              value={formData.legalAddress}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="г. Москва, ул. Примерная, д. 1"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Наименование банка *
            </label>
            <input
              type="text"
              name="bankName"
              value={formData.bankName}
              onChange={handleChange}
              required
              className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
              placeholder="ПАО Сбербанк"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                БИК *
              </label>
              <input
                type="text"
                name="bic"
                value={formData.bic}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="044525225"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Расчетный счет *
              </label>
              <input
                type="text"
                name="accountNumber"
                value={formData.accountNumber}
                onChange={handleChange}
                required
                className="w-full px-3 py-2 rounded-lg border border-gray-200 focus:outline-none focus:ring-2 focus:ring-primary-500"
                placeholder="40702810123456789012"
              />
            </div>
          </div>

          <div className="flex gap-3 pt-4">
            <Button type="button" variant="secondary" onClick={onClose} fullWidth>
              Отмена
            </Button>
            <Button type="submit" variant="primary" fullWidth>
              Сформировать чек
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};