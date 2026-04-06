// frontend/src/components/ui/PrintDocument.tsx
import React from 'react';

// Типы
interface OrderItem {
  productName: string;
  quantity: number;
  price: number;
  total: number;
  isWork?: boolean;
}

interface Order {
  id?: number;
  documentNumber?: string;
  documentType?: string;
  customerName?: string;
  clientName?: string;
  customerPhone?: string;
  clientPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  items?: OrderItem[];
  subtotal?: number;
  discount?: number;
  total?: number;
  paymentStatus?: 'paid' | 'unpaid';
  paymentMethod?: string;
  saleDate?: string | Date;
  sellerName?: string;
}

export type ReceiptType = 'individual' | 'legal';

export interface LegalEntityData {
  companyName: string;
  inn: string;
  kpp: string;
  legalAddress: string;
  bankName: string;
  bic: string;
  accountNumber: string;
}

interface PrintDocumentProps {
  order: Order | null;
  type?: 'receipt' | 'invoice';
  receiptType?: ReceiptType;
  legalData?: LegalEntityData | null;
}

// Реквизиты продавца (ИП Батвенко) - точь-в-точь как в референсе
const SELLER_DATA = {
  name: 'ИП БАТВЕНКО НИКОЛАЙ СЕРГЕЕВИЧ',
  shortName: 'ИП Батвенко Н.С.',
  inn: '381011379046',
  ogrn: '315385000059546',
  legalAddress: '664020, РОССИЯ, ИРКУТСКАЯ ОБЛ, Г ИРКУТСК, УЛ ЗОИ КОСМОДЕМЬЯНСКОЙ, Д 38',
  bankName: 'АО «ТБанк»',
  bankInn: '7710140679',
  bankBic: '044525974',
  correspondentAccount: '30101810145250000974',
  accountNumber: '40802810900000298096',
  phone: '+7(924)533-0880',
  email: 'swap38@mail.ru'
};

const LOGO_URL = '/images/logo1.png';

// Функция для преобразования суммы в пропись
const numberToWords = (num: number): string => {
  const rubles = Math.floor(num);
  const kopecks = Math.round((num - rubles) * 100);
  
  const units = ['', 'один', 'два', 'три', 'четыре', 'пять', 'шесть', 'семь', 'восемь', 'девять'];
  const teens = ['десять', 'одиннадцать', 'двенадцать', 'тринадцать', 'четырнадцать', 'пятнадцать', 'шестнадцать', 'семнадцать', 'восемнадцать', 'девятнадцать'];
  const tens = ['', '', 'двадцать', 'тридцать', 'сорок', 'пятьдесят', 'шестьдесят', 'семьдесят', 'восемьдесят', 'девяносто'];
  const hundreds = ['', 'сто', 'двести', 'триста', 'четыреста', 'пятьсот', 'шестьсот', 'семьсот', 'восемьсот', 'девятьсот'];
  
  const getRublesWord = (n: number): string => {
    if (n % 100 >= 11 && n % 100 <= 19) return 'рублей';
    switch (n % 10) {
      case 1: return 'рубль';
      case 2: case 3: case 4: return 'рубля';
      default: return 'рублей';
    }
  };
  
  const convertNumber = (n: number): string => {
    if (n === 0) return 'ноль';
    
    let result = '';
    const millions = Math.floor(n / 1000000);
    const thousands = Math.floor((n % 1000000) / 1000);
    const remainder = n % 1000;
    
    const convertThreeDigits = (num: number, isThousand: boolean = false): string => {
      if (num === 0) return '';
      
      let res = '';
      const h = Math.floor(num / 100);
      const t = Math.floor((num % 100) / 10);
      const u = num % 10;
      
      if (h > 0) res += hundreds[h] + ' ';
      
      if (t >= 2) {
        res += tens[t] + ' ';
        if (u > 0) res += (isThousand && u === 1 ? 'одна' : (isThousand && u === 2 ? 'две' : units[u])) + ' ';
      } else if (t === 1) {
        res += teens[u] + ' ';
      } else if (u > 0) {
        res += (isThousand && u === 1 ? 'одна' : (isThousand && u === 2 ? 'две' : units[u])) + ' ';
      }
      
      return res;
    };
    
    if (millions > 0) {
      result += convertThreeDigits(millions) + (millions === 1 ? 'миллион ' : (millions >= 2 && millions <= 4 ? 'миллиона ' : 'миллионов '));
    }
    if (thousands > 0) {
      result += convertThreeDigits(thousands, true) + (thousands === 1 ? 'тысяча ' : (thousands >= 2 && thousands <= 4 ? 'тысячи ' : 'тысяч '));
    }
    if (remainder > 0 || (millions === 0 && thousands === 0)) {
      result += convertThreeDigits(remainder);
    }
    
    return result.trim();
  };
  
  const rublesStr = convertNumber(rubles);
  const rublesWord = getRublesWord(rubles);
  const kopecksStr = kopecks < 10 ? `0${kopecks}` : `${kopecks}`;
  
  return `${rublesStr} ${rublesWord} ${kopecksStr} копеек`;
};

const escapeHtml = (str: string): string => {
  if (!str) return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
};

// Генерация Счета на оплату (точная копия референса)
const renderInvoiceHTML = (
  order: Order | null,
  documentNumber: string,
  formattedDate: string,
  items: OrderItem[],
  subtotal: number,
  discount: number,
  total: number,
  customerName: string,
  customerPhone: string,
  customerAddress: string,
  sellerName: string,
  paymentStatus: 'paid' | 'unpaid' | undefined
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Счет на оплату №${documentNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Times New Roman', 'Arial', sans-serif;
          background: #e5e7eb;
          padding: 40px;
          font-size: 12px;
        }
        .document {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 25px 30px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        /* Банковские реквизиты как в референсе */
        .bank-details {
          font-size: 9pt;
          margin-bottom: 20px;
          border-bottom: 1px solid #000;
          padding-bottom: 10px;
        }
        .bank-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        .bank-row-header {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        /* Header с логотипом */
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin: 20px 0 25px;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 65px;
          height: 65px;
          object-fit: contain;
        }
        .company-title {
          font-size: 18px;
          font-weight: bold;
        }
        .company-subtitle {
          font-size: 10px;
          color: #666;
        }
        .doc-info {
          text-align: right;
        }
        .doc-title {
          font-size: 20px;
          font-weight: bold;
        }
        .doc-number {
          font-size: 11px;
          color: #666;
          margin-top: 5px;
        }
        
        /* Стороны */
        .parties {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin: 20px 0;
          font-size: 10pt;
        }
        .party-block {
          flex: 1;
        }
        .party-label {
          font-weight: bold;
          margin-bottom: 5px;
        }
        .party-text {
          line-height: 1.4;
        }
        
        /* Таблица */
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .items-table th,
        .items-table td {
          border: 1px solid #000;
          padding: 8px;
        }
        .items-table th {
          background: #f8f9fa;
          text-align: center;
          font-weight: bold;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        
        /* Итоги */
        .totals {
          margin: 15px 0;
          text-align: right;
        }
        .total-final {
          font-size: 13pt;
          font-weight: bold;
          margin-top: 10px;
          padding-top: 5px;
          border-top: 1px solid #000;
        }
        
        /* Пропись */
        .amount-words {
          margin: 15px 0;
          padding: 10px;
          background: #f8f9fa;
        }
        
        /* Подписи */
        .signatures {
          display: flex;
          justify-content: space-between;
          margin: 30px 0 20px;
        }
        .signature-line {
          width: 200px;
          border-top: 1px solid #000;
          margin-top: 30px;
        }
        .signature-label {
          font-size: 9pt;
          margin-top: 5px;
          text-align: center;
        }
        
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 8pt;
          color: #888;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        
        @media print {
          body { background: white; padding: 0; }
          .document { box-shadow: none; padding: 20px; }
          .items-table th { background: #000 !important; color: white !important; -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        }
      </style>
    </head>
    <body>
      <div class="document">
        <!-- Банковские реквизиты как в референсе -->
        <div class="bank-details">
          <div class="bank-row">
            <span>Банк получателя</span>
            <span>БИК</span>
            <span>Сч. №</span>
          </div>
          <div class="bank-row">
            <span>${SELLER_DATA.bankName}</span>
            <span>${SELLER_DATA.bankBic}</span>
            <span>${SELLER_DATA.correspondentAccount}</span>
          </div>
          <div class="bank-row" style="margin-top: 8px;">
            <span>Получатель</span>
            <span></span>
            <span>Сч. №</span>
          </div>
          <div class="bank-row">
            <span>${SELLER_DATA.name}</span>
            <span></span>
            <span>${SELLER_DATA.accountNumber}</span>
          </div>
        </div>
        
        <!-- Header с логотипом -->
        <div class="header">
          <div class="logo-section">
            <img src="${LOGO_URL}" alt="SWAP SERVICE 38" class="logo" 
                 onerror="this.style.display='none'; this.parentElement.innerHTML = '<div style=\\'width:65px;height:65px;background:#1E3A8A;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold\\'>ЛОГО</div>' + this.parentElement.innerHTML">
            <div>
              <div class="company-title">SWAP SERVICE 38</div>
              <div class="company-subtitle">Свап • Автосервис • Тюнинг • Запчасти</div>
            </div>
          </div>
          <div class="doc-info">
            <div class="doc-title">Счет на оплату</div>
            <div class="doc-number">№ ${documentNumber} от ${formattedDate}</div>
          </div>
        </div>
        
        <!-- Поставщик и Покупатель -->
        <div class="parties">
          <div class="party-block">
            <div class="party-label">Поставщик:</div>
            <div class="party-text">
              ${SELLER_DATA.name}<br>
              ИНН ${SELLER_DATA.inn}<br>
              ${SELLER_DATA.legalAddress}
            </div>
          </div>
          <div class="party-block">
            <div class="party-label">Покупатель:</div>
            <div class="party-text">
              ${escapeHtml(customerName)}<br>
              ${customerPhone ? `Тел: ${escapeHtml(customerPhone)}` : ''}
              ${customerAddress ? `<br>${escapeHtml(customerAddress)}` : ''}
            </div>
          </div>
        </div>
        
        <!-- Таблица товаров -->
        <table class="items-table">
          <thead>
            <tr>
              <th width="5%">№</th>
              <th width="50%">Товары (работы, услуги)</th>
              <th width="8%">кол-во</th>
              <th width="7%">Ед.</th>
              <th width="8%">НДС</th>
              <th width="11%">Цена</th>
              <th width="11%">Сумма</th>
            </tr>
          </thead>
          <tbody>
            ${items.length > 0 ? items.map((item, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">${escapeHtml(item.productName)}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-center">${item.isWork ? 'н/ч' : 'шт'}</td>
                <td class="text-center">Без НДС</td>
                <td class="text-right">${item.price.toLocaleString('ru-RU')}</td>
                <td class="text-right">${item.total.toLocaleString('ru-RU')}</td>
              </tr>
            `).join('') : `
              <tr>
                <td colspan="7" class="text-center">Нет товаров</td>
              </tr>
            `}
            <tr style="background: #f8f9fa;">
              <td colspan="6" class="text-right"><strong>Итого:</strong></td>
              <td class="text-right"><strong>${total.toLocaleString('ru-RU')}</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div class="totals">
          <div>Всего наименований ${items.length}, на сумму ${total.toLocaleString('ru-RU')} руб.</div>
          <div class="total-final">Итого к оплате: ${total.toLocaleString('ru-RU')}</div>
        </div>
        
        <div class="amount-words">
          ${numberToWords(total)} руб.
        </div>
        
        <div class="signatures">
          <div>
            <div class="signature-line"></div>
            <div class="signature-label">Исполнитель</div>
            <div class="signature-label">Батвенко Николай Сергеевич</div>
          </div>
          <div>
            <div class="signature-line"></div>
            <div class="signature-label">Заказчик</div>
          </div>
        </div>
        
        <div class="footer">
          <p>SWAP SERVICE 38 • ${formattedDate}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Генерация Чека (Физ лицо) - такой же стиль
const renderIndividualReceiptHTML = (
  order: Order | null,
  documentNumber: string,
  formattedDate: string,
  items: OrderItem[],
  subtotal: number,
  discount: number,
  total: number,
  customerName: string,
  customerPhone: string,
  customerEmail: string,
  sellerName: string,
  paymentStatus: 'paid' | 'unpaid' | undefined
): string => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Чек №${documentNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Times New Roman', 'Arial', sans-serif;
          background: #e5e7eb;
          padding: 40px;
          font-size: 12px;
        }
        .document {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 25px 30px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid #000;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 65px;
          height: 65px;
          object-fit: contain;
        }
        .company-title {
          font-size: 18px;
          font-weight: bold;
        }
        .company-subtitle {
          font-size: 10px;
          color: #666;
        }
        .doc-info {
          text-align: right;
        }
        .doc-title {
          font-size: 20px;
          font-weight: bold;
        }
        .doc-number {
          font-size: 11px;
          color: #666;
          margin-top: 5px;
        }
        
        .parties {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin: 20px 0;
          font-size: 10pt;
        }
        .party-block {
          flex: 1;
        }
        .party-label {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .items-table th,
        .items-table td {
          border: 1px solid #000;
          padding: 8px;
        }
        .items-table th {
          background: #f8f9fa;
          text-align: center;
          font-weight: bold;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        
        .totals {
          margin: 15px 0;
          text-align: right;
        }
        .total-final {
          font-size: 13pt;
          font-weight: bold;
          margin-top: 10px;
          padding-top: 5px;
          border-top: 1px solid #000;
        }
        
        .amount-words {
          margin: 15px 0;
          padding: 10px;
          background: #f8f9fa;
        }
        
        .status {
          text-align: center;
          margin: 20px 0;
          padding: 10px;
          font-weight: bold;
        }
        .status-paid { background: #d1fae5; color: #065f46; }
        .status-unpaid { background: #fee2e2; color: #991b1b; }
        
        .signatures {
          display: flex;
          justify-content: space-between;
          margin: 30px 0 20px;
        }
        .signature-line {
          width: 200px;
          border-top: 1px solid #000;
          margin-top: 30px;
        }
        .signature-label {
          font-size: 9pt;
          margin-top: 5px;
          text-align: center;
        }
        
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 8pt;
          color: #888;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        
        @media print {
          body { background: white; padding: 0; }
          .document { box-shadow: none; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="document">
        <div class="header">
          <div class="logo-section">
            <img src="${LOGO_URL}" alt="SWAP SERVICE 38" class="logo" 
                 onerror="this.style.display='none'; this.parentElement.innerHTML = '<div style=\\'width:65px;height:65px;background:#1E3A8A;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold\\'>ЛОГО</div>' + this.parentElement.innerHTML">
            <div>
              <div class="company-title">SWAP SERVICE 38</div>
              <div class="company-subtitle">Свап • Автосервис • Тюнинг • Запчасти</div>
            </div>
          </div>
          <div class="doc-info">
            <div class="doc-title">ЧЕК</div>
            <div class="doc-number">№ ${documentNumber} от ${formattedDate}</div>
          </div>
        </div>
        
        <div class="parties">
          <div class="party-block">
            <div class="party-label">Продавец:</div>
            <div class="party-text">
              ${sellerName}<br>
            </div>
          </div>
          <div class="party-block">
            <div class="party-label">Покупатель:</div>
            <div class="party-text">
              ${escapeHtml(customerName)}<br>
              ${customerPhone ? `Тел: ${escapeHtml(customerPhone)}` : ''}
              ${customerEmail ? `<br>Email: ${escapeHtml(customerEmail)}` : ''}
            </div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr><th width="5%">№</th><th width="50%">Наименование</th><th width="10%">Кол-во</th><th width="10%">Ед.</th><th width="12%">Цена</th><th width="13%">Сумма</th></tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">${escapeHtml(item.productName)}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-center">${item.isWork ? 'н/ч' : 'шт'}</td>
                <td class="text-right">${item.price.toLocaleString('ru-RU')} ₽</td>
                <td class="text-right">${item.total.toLocaleString('ru-RU')} ₽</td>
              </tr>
            `).join('')}
            <tr style="background: #f8f9fa;">
              <td colspan="5" class="text-right"><strong>ИТОГО:</strong></td>
              <td class="text-right"><strong>${total.toLocaleString('ru-RU')} ₽</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div class="totals">
          <div>Всего наименований ${items.length}, на сумму ${total.toLocaleString('ru-RU')} руб.</div>
          <div class="total-final">Итого к оплате: ${total.toLocaleString('ru-RU')} ₽</div>
        </div>
        
        <div class="amount-words">
          ${numberToWords(total)} руб.
        </div>
        
        <div class="status ${paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}">
          ${paymentStatus === 'paid' ? '✓ ОПЛАЧЕНО' : '● ОЖИДАЕТ ОПЛАТЫ'}
        </div>
        
        <div class="signatures">
          <div>
            <div class="signature-line"></div>
            <div class="signature-label">Продавец</div>
            <div class="signature-label">${sellerName !== '___________________' ? escapeHtml(sellerName) : 'Батвенко Н.С.'}</div>
          </div>
          <div>
            <div class="signature-line"></div>
            <div class="signature-label">Покупатель</div>
            <div class="signature-label">${escapeHtml(customerName)}</div>
          </div>
        </div>
        
        <div class="footer">
          <p>SWAP SERVICE 38 • Спасибо за покупку! • ${formattedDate}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Генерация Счет-фактуры (Юр лицо)
const renderLegalReceiptHTML = (
  order: Order | null,
  documentNumber: string,
  formattedDate: string,
  items: OrderItem[],
  subtotal: number,
  discount: number,
  total: number,
  customerName: string,
  sellerName: string,
  legalData: LegalEntityData | null,
  paymentStatus: 'paid' | 'unpaid' | undefined
): string => {
  const buyerCompanyName = legalData?.companyName ?? customerName;
  const buyerInn = legalData?.inn ?? '';
  const buyerKpp = legalData?.kpp ?? '';
  const buyerLegalAddress = legalData?.legalAddress ?? '';
  
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>Счет-фактура №${documentNumber}</title>
      <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
          font-family: 'Times New Roman', 'Arial', sans-serif;
          background: #e5e7eb;
          padding: 40px;
          font-size: 12px;
        }
        .document {
          max-width: 800px;
          margin: 0 auto;
          background: white;
          padding: 25px 30px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }
        
        .header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 25px;
          padding-bottom: 15px;
          border-bottom: 2px solid #000;
        }
        .logo-section {
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .logo {
          width: 65px;
          height: 65px;
          object-fit: contain;
        }
        .company-title {
          font-size: 18px;
          font-weight: bold;
        }
        .company-subtitle {
          font-size: 10px;
          color: #666;
        }
        .doc-info {
          text-align: right;
        }
        .doc-title {
          font-size: 20px;
          font-weight: bold;
        }
        .doc-number {
          font-size: 11px;
          color: #666;
          margin-top: 5px;
        }
        
        .parties {
          display: flex;
          justify-content: space-between;
          gap: 20px;
          margin: 20px 0;
          font-size: 10pt;
        }
        .party-block {
          flex: 1;
        }
        .party-label {
          font-weight: bold;
          margin-bottom: 5px;
        }
        
        .items-table {
          width: 100%;
          border-collapse: collapse;
          margin: 20px 0;
        }
        .items-table th,
        .items-table td {
          border: 1px solid #000;
          padding: 8px;
        }
        .items-table th {
          background: #f8f9fa;
          text-align: center;
          font-weight: bold;
        }
        .text-center { text-align: center; }
        .text-right { text-align: right; }
        .text-left { text-align: left; }
        
        .totals {
          margin: 15px 0;
          text-align: right;
        }
        .total-final {
          font-size: 13pt;
          font-weight: bold;
          margin-top: 10px;
          padding-top: 5px;
          border-top: 1px solid #000;
        }
        
        .bank-details {
          margin: 20px 0;
          padding: 10px;
          background: #f8f9fa;
          font-size: 9pt;
        }
        .bank-row {
          display: flex;
          justify-content: space-between;
          margin-bottom: 4px;
        }
        
        .status {
          text-align: center;
          margin: 20px 0;
          padding: 10px;
          font-weight: bold;
        }
        .status-paid { background: #d1fae5; color: #065f46; }
        .status-unpaid { background: #fee2e2; color: #991b1b; }
        
        .signatures {
          display: flex;
          justify-content: space-between;
          margin: 30px 0 20px;
        }
        .signature-line {
          width: 200px;
          border-top: 1px solid #000;
          margin-top: 30px;
        }
        .signature-label {
          font-size: 9pt;
          margin-top: 5px;
          text-align: center;
        }
        
        .footer {
          margin-top: 20px;
          text-align: center;
          font-size: 8pt;
          color: #888;
          border-top: 1px solid #ddd;
          padding-top: 10px;
        }
        
        @media print {
          body { background: white; padding: 0; }
          .document { box-shadow: none; padding: 20px; }
        }
      </style>
    </head>
    <body>
      <div class="document">
        <div class="header">
          <div class="logo-section">
            <img src="${LOGO_URL}" alt="SWAP SERVICE 38" class="logo" 
                 onerror="this.style.display='none'; this.parentElement.innerHTML = '<div style=\\'width:65px;height:65px;background:#1E3A8A;border-radius:12px;display:flex;align-items:center;justify-content:center;color:white;font-size:10px;font-weight:bold\\'>ЛОГО</div>' + this.parentElement.innerHTML">
            <div>
              <div class="company-title">SWAP SERVICE 38</div>
              <div class="company-subtitle">Свап • Автосервис • Тюнинг • Запчасти</div>
            </div>
          </div>
          <div class="doc-info">
            <div class="doc-title">СЧЕТ-ФАКТУРА</div>
            <div class="doc-number">№ ${documentNumber} от ${formattedDate}</div>
          </div>
        </div>
        
        <div class="parties">
          <div class="party-block">
            <div class="party-label">ПРОДАВЕЦ:</div>
            <div class="party-text">
              ${SELLER_DATA.name}<br>
              ИНН: ${SELLER_DATA.inn}<br>
              ОГРНИП: ${SELLER_DATA.ogrn}<br>
              ${SELLER_DATA.legalAddress}
            </div>
          </div>
          <div class="party-block">
            <div class="party-label">ПОКУПАТЕЛЬ:</div>
            <div class="party-text">
              ${escapeHtml(buyerCompanyName)}<br>
              ${buyerInn ? `ИНН: ${escapeHtml(buyerInn)}${buyerKpp ? ` / КПП: ${escapeHtml(buyerKpp)}` : ''}` : ''}<br>
              ${buyerLegalAddress ? escapeHtml(buyerLegalAddress) : ''}
            </div>
          </div>
        </div>
        
        <table class="items-table">
          <thead>
            <tr><th width="5%">№</th><th width="50%">Наименование</th><th width="10%">Кол-во</th><th width="10%">Ед.</th><th width="12%">Цена</th><th width="13%">Сумма</th></tr>
          </thead>
          <tbody>
            ${items.map((item, idx) => `
              <tr>
                <td class="text-center">${idx + 1}</td>
                <td class="text-left">${escapeHtml(item.productName)}</td>
                <td class="text-center">${item.quantity}</td>
                <td class="text-center">${item.isWork ? 'н/ч' : 'шт'}</td>
                <td class="text-right">${item.price.toLocaleString('ru-RU')} ₽</td>
                <td class="text-right">${item.total.toLocaleString('ru-RU')} ₽</td>
              </tr>
            `).join('')}
            <tr style="background: #f8f9fa;">
              <td colspan="5" class="text-right"><strong>ИТОГО:</strong></td>
              <td class="text-right"><strong>${total.toLocaleString('ru-RU')} ₽</strong></td>
            </tr>
          </tbody>
        </table>
        
        <div class="totals">
          <div class="total-final">Итого к оплате: ${total.toLocaleString('ru-RU')} ₽</div>
        </div>
        
        <div class="bank-details">
          <div class="bank-row"><strong>Банковские реквизиты продавца:</strong></div>
          <div class="bank-row">Р/с: ${SELLER_DATA.accountNumber}</div>
          <div class="bank-row">Банк: ${SELLER_DATA.bankName}</div>
          <div class="bank-row">БИК: ${SELLER_DATA.bankBic}</div>
          <div class="bank-row">К/с: ${SELLER_DATA.correspondentAccount}</div>
        </div>
        
        <div class="status ${paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}">
          ${paymentStatus === 'paid' ? '✓ ОПЛАЧЕНО' : '● ОЖИДАЕТ ОПЛАТЫ'}
        </div>
        
        <div class="signatures">
          <div>
            <div class="signature-line"></div>
            <div class="signature-label">Руководитель</div>
          </div>
        
        <div class="footer">
          <p>SWAP SERVICE 38 • ${formattedDate}</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

export const PrintDocument: React.FC<PrintDocumentProps> = ({ 
  order, 
  type = 'invoice',
  receiptType = 'individual',
  legalData = null 
}) => {
  
  const renderHTML = (): string => {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const isInvoice = type === 'invoice';
    const isLegalReceipt = type === 'receipt' && receiptType === 'legal';
    const isIndividualReceipt = type === 'receipt' && receiptType === 'individual';
    
    const subtotal = order?.subtotal ?? 0;
    const discount = order?.discount ?? 0;
    const total = order?.total ?? 0;
    const items = order?.items ?? [];
    const customerName = order?.customerName ?? order?.clientName ?? '___________________';
    const customerPhone = order?.customerPhone ?? order?.clientPhone ?? '';
    const customerEmail = order?.customerEmail ?? '';
    const customerAddress = order?.customerAddress ?? '';
    const documentNumber = order?.documentNumber ?? Math.floor(Math.random() * 1000000000).toString();
    const sellerName = order?.sellerName ?? '___________________';
    const paymentStatus = order?.paymentStatus;
    
    if (isInvoice) {
      return renderInvoiceHTML(order, documentNumber, formattedDate, items, subtotal, discount, total, customerName, customerPhone, customerAddress, sellerName, paymentStatus);
    }
    
    if (isLegalReceipt) {
      return renderLegalReceiptHTML(order, documentNumber, formattedDate, items, subtotal, discount, total, customerName, sellerName, legalData, paymentStatus);
    }
    
    return renderIndividualReceiptHTML(order, documentNumber, formattedDate, items, subtotal, discount, total, customerName, customerPhone, customerEmail, sellerName, paymentStatus);
  };
  
  const print = (): void => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Пожалуйста, разрешите всплывающие окна для печати');
      return;
    }
    printWindow.document.write(renderHTML());
    printWindow.document.close();
    printWindow.focus();
    printWindow.onload = () => printWindow.print();
  };
  
  return { renderHTML, print };
};

export default PrintDocument;