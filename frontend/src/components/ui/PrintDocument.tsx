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
}

interface PrintDocumentProps {
  order: Order | null;
  type?: 'receipt' | 'invoice';
}

// Используем абсолютный путь от корня public
const LOGO_URL = '/images/logo1.png';

export const PrintDocument: React.FC<PrintDocumentProps> = ({ order, type = 'receipt' }) => {
  
  const renderHTML = (): string => {
    const currentDate = new Date();
    const formattedDate = currentDate.toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
    
    const isReceipt = type === 'receipt';
    const isInvoice = type === 'invoice';
    const title = isReceipt ? 'ЧЕК' : 'СЧЕТ НА ОПЛАТУ';
    
    // Безопасное получение суммы
    const subtotal = order?.subtotal ?? 0;
    const discount = order?.discount ?? 0;
    const total = order?.total ?? 0;
    const items = order?.items ?? [];
    const customerName = order?.customerName ?? order?.clientName ?? '___________________';
    const customerPhone = order?.customerPhone ?? order?.clientPhone ?? '___________________';

    return `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <title>${title} №${order?.documentNumber ?? ''}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          
          body {
            font-family: 'Times New Roman', 'Arial', sans-serif;
            background: #e5e7eb;
            padding: 40px;
            font-size: 12px;
            line-height: 1.4;
          }
          
          .document {
            max-width: 800px;
            margin: 0 auto;
            background: white;
            padding: 30px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          
          /* Header */
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
            gap: 15px;
          }
          
          .logo {
            width: 70px;
            height: 70px;
            object-fit: contain;
          }
          
          .logo-placeholder {
            width: 70px;
            height: 70px;
            background: #1E3A8A;
            border-radius: 12px;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-size: 12px;
            font-weight: bold;
          }
          
          .company-title {
            font-size: 20px;
            font-weight: bold;
            color: #000;
          }
          
          .company-subtitle {
            font-size: 11px;
            color: #666;
            margin-top: 4px;
          }
          
          .doc-info {
            text-align: right;
          }
          
          .doc-title {
            font-size: 22px;
            font-weight: bold;
            color: #000;
            letter-spacing: 2px;
          }
          
          .doc-number {
            font-size: 12px;
            color: #666;
            margin-top: 5px;
          }
          
          /* Seller Info */
          .seller-info {
            background: #f8f9fa;
            padding: 12px;
            margin: 20px 0;
            border-left: 3px solid #000;
            font-size: 11px;
          }
          
          .seller-name {
            font-weight: bold;
            font-size: 13px;
            margin-bottom: 5px;
          }
          
          /* Client Info */
          .client-info {
            margin: 20px 0;
            padding: 12px;
            background: #f8f9fa;
            border-radius: 4px;
          }
          
          .client-row {
            display: flex;
            margin-bottom: 6px;
          }
          
          .client-label {
            width: 100px;
            font-weight: bold;
            color: #555;
          }
          
          .client-value {
            flex: 1;
          }
          
          /* Table */
          .items-table {
            width: 100%;
            border-collapse: collapse;
            margin: 20px 0;
          }
          
          .items-table th {
            background: #000;
            color: white;
            padding: 10px;
            text-align: left;
            font-weight: bold;
            font-size: 11px;
          }
          
          .items-table td {
            border-bottom: 1px solid #e5e7eb;
            padding: 10px;
            font-size: 11px;
          }
          
          .items-table tr:last-child td {
            border-bottom: none;
          }
          
          /* Totals */
          .totals {
            margin: 20px 0;
            text-align: right;
            padding: 15px;
            background: #f8f9fa;
          }
          
          .totals-row {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 8px;
          }
          
          .totals-label {
            width: 150px;
            font-weight: bold;
          }
          
          .totals-value {
            width: 120px;
            text-align: right;
          }
          
          .total-final {
            font-size: 16px;
            margin-top: 8px;
            padding-top: 8px;
            border-top: 2px solid #000;
          }
          
          .total-final .totals-label,
          .total-final .totals-value {
            font-size: 16px;
            font-weight: bold;
          }
          
          /* Status */
          .status {
            text-align: center;
            margin: 20px 0;
            padding: 12px;
          }
          
          .status-paid {
            background: #d1fae5;
            color: #065f46;
            font-weight: bold;
            font-size: 14px;
          }
          
          .status-unpaid {
            background: #fee2e2;
            color: #991b1b;
            font-weight: bold;
            font-size: 14px;
          }
          
          /* Payment Details */
          .payment-details {
            margin: 20px 0;
            padding: 12px;
            background: #f8f9fa;
            font-size: 10px;
            border-left: 3px solid #000;
          }
          
          .payment-title {
            font-weight: bold;
            margin-bottom: 8px;
            font-size: 11px;
          }
          
          /* Footer */
          .footer {
            margin-top: 25px;
            padding-top: 15px;
            border-top: 1px solid #e5e7eb;
            text-align: center;
            font-size: 9px;
            color: #666;
          }
          
          .signature {
            margin-top: 30px;
            display: flex;
            justify-content: space-between;
          }
          
          .signature-line {
            width: 200px;
            border-top: 1px solid #000;
            margin-top: 30px;
          }
          
          .signature-text {
            font-size: 10px;
            margin-top: 5px;
          }
          
          @media print {
            body {
              background: white;
              padding: 0;
              margin: 0;
            }
            .document {
              box-shadow: none;
              padding: 20px;
            }
            .items-table th {
              background: #000 !important;
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
            .status-paid, .status-unpaid {
              -webkit-print-color-adjust: exact;
              print-color-adjust: exact;
            }
          }
        </style>
      </head>
      <body>
        <div class="document">
          <!-- Header -->
          <div class="header">
            <div class="logo-section">
              <img src="${LOGO_URL}" alt="SWAP SERVICE 38" class="logo" 
                   onerror="this.style.display='none'; this.parentElement.innerHTML = '<div class=\\'logo-placeholder\\'>ЛОГО</div>' + this.parentElement.innerHTML">
              <div>
                <div class="company-title">SWAP SERVICE 38</div>
                <div class="company-subtitle">Свап • Автосервис • Тюнинг • Запчасти</div>
              </div>
            </div>
            <div class="doc-info">
              <div class="doc-title">${title}</div>
              <div class="doc-number">№ ${order?.documentNumber ?? ''} от ${formattedDate}</div>
            </div>
          </div>
          
          <!-- Seller Info (ИП Батвенко) -->
          <div class="seller-info">
            <div class="seller-name">ИП Батвенко Николай Сергеевич</div>
            <div>ИНН: 123456789012 / ОГРНИП: 312345678901234</div>
            <div>Россия, Иркутская область, Иркутск, ул. Новаторов, 36</div>
            <div>Тел: +7(924)533-0880 | Email: swap38@mail.ru</div>
          </div>
          
          <!-- Client Info -->
          <div class="client-info">
            <div class="client-row">
              <div class="client-label">Покупатель:</div>
              <div class="client-value">${escapeHtml(customerName)}</div>
            </div>
            <div class="client-row">
              <div class="client-label">Телефон:</div>
              <div class="client-value">${escapeHtml(customerPhone)}</div>
            </div>
            ${order?.customerEmail ? `
            <div class="client-row">
              <div class="client-label">Email:</div>
              <div class="client-value">${escapeHtml(order.customerEmail)}</div>
            </div>
            ` : ''}
            ${order?.customerAddress ? `
            <div class="client-row">
              <div class="client-label">Адрес:</div>
              <div class="client-value">${escapeHtml(order.customerAddress)}</div>
            </div>
            ` : ''}
          </div>
          
          <!-- Items Table -->
          <table class="items-table">
            <thead>
              <tr>
                <th width="5%">№</th>
                <th width="55%">Наименование</th>
                <th width="10%">Кол-во</th>
                <th width="15%">Цена</th>
                <th width="15%">Сумма</th>
              </tr>
            </thead>
            <tbody>
              ${items.length > 0 ? items.map((item, idx) => `
                <tr>
                  <td style="text-align: center;">${idx + 1}</td>
                  <td>${escapeHtml(item.productName)}</td>
                  <td style="text-align: center;">${item.quantity} ${item.isWork ? 'н/ч' : 'шт'}</td>
                  <td style="text-align: right;">${item.price.toLocaleString()} ₽</td>
                  <td style="text-align: right; font-weight: bold;">${item.total.toLocaleString()} ₽</td>
                </tr>
              `).join('') : `
                <tr>
                  <td colspan="5" style="text-align: center;">Нет товаров</td>
                </tr>
              `}
            </tbody>
          </table>
          
          <!-- Totals -->
          <div class="totals">
            <div class="totals-row">
              <div class="totals-label">Сумма:</div>
              <div class="totals-value">${subtotal.toLocaleString()} ₽</div>
            </div>
            ${discount > 0 ? `
            <div class="totals-row" style="color: #065f46;">
              <div class="totals-label">Скидка:</div>
              <div class="totals-value">-${discount.toLocaleString()} ₽</div>
            </div>
            ` : ''}
            <div class="totals-row total-final">
              <div class="totals-label">ИТОГО К ОПЛАТЕ:</div>
              <div class="totals-value">${total.toLocaleString()} ₽</div>
            </div>
          </div>
          
          <!-- Status -->
          <div class="status ${order?.paymentStatus === 'paid' ? 'status-paid' : 'status-unpaid'}">
            ${order?.paymentStatus === 'paid' ? '✓ ОПЛАЧЕНО' : '● ОЖИДАЕТ ОПЛАТЫ'}
          </div>
          
          ${isInvoice && order?.paymentStatus !== 'paid' ? `
          <!-- Payment Details -->
          <div class="payment-details">
            <div class="payment-title">РЕКВИЗИТЫ ДЛЯ ОПЛАТЫ:</div>
            <div>Получатель: ИП Батвенко Николай Сергеевич</div>
            <div>ИНН: 123456789012 / ОГРНИП: 312345678901234</div>
            <div>Р/с: 40802810123456789012</div>
            <div>Банк: ИРКУТСКОЕ ОТДЕЛЕНИЕ №1234 ПАО СБЕРБАНК</div>
            <div>БИК: 042520001 / К/с: 30101810100000000123</div>
            <div style="margin-top: 8px;"><strong>Назначение платежа:</strong> Оплата по ${title.toLowerCase()} №${order?.documentNumber ?? ''} от ${formattedDate}</div>
          </div>
          ` : ''}
          
          ${isReceipt ? `
          <div class="payment-details" style="background: #d1fae5; border-left-color: #065f46;">
            <div class="payment-title">СПАСИБО ЗА ПОКУПКУ!</div>
            <div>Данный документ является фискальным чеком и подтверждает факт оплаты.</div>
          </div>
          ` : ''}
          
          <!-- Signature -->
          <div class="signature">
            <div>
              <div class="signature-line"></div>
              <div class="signature-text">Подпись заказчика</div>
            </div>
            <div>
              <div class="signature-line"></div>
              <div class="signature-text">ИП Батвенко Н.С.</div>
            </div>
          </div>
          
          <!-- Footer -->
          <div class="footer">
            <p>SWAP SERVICE 38 • Все права защищены • ${formattedDate}</p>
          </div>
        </div>
      </body>
      </html>
    `;
  };

  // Функция для экранирования HTML спецсимволов (безопасность)
  const escapeHtml = (str: string): string => {
    if (!str) return '';
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  };

  // Функция для печати
  const print = (): void => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Пожалуйста, разрешите всплывающие окна для печати');
      return;
    }
    
    printWindow.document.write(renderHTML());
    printWindow.document.close();
    printWindow.focus();
    
    // Ждем загрузки всех ресурсов (изображений)
    printWindow.onload = () => {
      printWindow.print();
    };
  };

  return { renderHTML, print };
};

export default PrintDocument;