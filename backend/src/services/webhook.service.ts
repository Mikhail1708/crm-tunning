// backend/src/services/webhook.service.ts (CRM)
import axios from 'axios';
import crypto from 'crypto';

const wait = (delayMs: number): Promise<void> =>
  new Promise(resolve => setTimeout(resolve, delayMs));

/**
 * Каноническая сериализация — сортировка ключей по алфавиту
 */
const canonicalStringify = (obj: Record<string, any>): string => {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, any> = {};
  for (const key of sortedKeys) {
    sortedObj[key] = obj[key];
  }
  return JSON.stringify(sortedObj);
};

/**
 * Отправка вебхука на сайт при изменении статуса заказа
 */
export async function sendOrderStatusWebhook(
  crmOrderId: number,
  status: string,
  documentNumber: string,
  version: number
): Promise<boolean> {
  // Read configuration at call time. server.ts loads dotenv after module
  // imports, so module-scope snapshots can permanently capture empty values.
  const webhookUrl = process.env.SITE_WEBHOOK_URL || '';
  const webhookSecret = process.env.WEBHOOK_SECRET || '';
  const maxAttempts = Math.max(1, Number.parseInt(process.env.WEBHOOK_MAX_ATTEMPTS || '5', 10) || 5);
  const retryBaseMs = Math.max(50, Number.parseInt(process.env.WEBHOOK_RETRY_BASE_MS || '250', 10) || 250);

  if (!webhookUrl) {
    console.warn('⚠️ WEBHOOK_URL не настроен, вебхук не отправлен');
    return false;
  }

  if (!webhookSecret) {
    console.warn('⚠️ WEBHOOK_SECRET не настроен, вебхук не отправлен');
    return false;
  }

  const payload = {
    crmOrderId,
    documentNumber,
    status,
    version,
    timestamp: new Date().toISOString(),
  };

  // ✅ ИСПОЛЬЗУЕМ КАНОНИЧЕСКУЮ СЕРИАЛИЗАЦИЮ
  const payloadString = canonicalStringify(payload);

  console.log(`Sending order status webhook (CRM ID: ${crmOrderId}, status: ${status})`);

  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    try {
      const response = await axios.post(webhookUrl, payload, {
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Signature': signature,
        },
        timeout: 10000,
      });

      if (response.status === 200 || response.status === 201) {
        console.log(`Order status webhook delivered (CRM ID: ${crmOrderId}, status: ${status}, attempt: ${attempt})`);
        return true;
      }
    } catch (error: any) {
      const responseStatus = error.response?.status;
      const retryable = !responseStatus || [404, 409, 429].includes(responseStatus) || responseStatus >= 500;
      console.error(
        `Order status webhook failed (CRM ID: ${crmOrderId}, attempt: ${attempt}/${maxAttempts}, status: ${responseStatus || error.code || 'request_failed'})`
      );
      if (!retryable) return false;
    }

    if (attempt < maxAttempts) {
      await wait(Math.min(retryBaseMs * (2 ** (attempt - 1)), 5000));
    }
  }

  return false;
}
