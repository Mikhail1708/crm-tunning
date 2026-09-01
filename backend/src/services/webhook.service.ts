import axios from 'axios';
import crypto from 'crypto';

export type OrderStatusWebhookPayload = {
  eventId: string;
  crmOrderId: number;
  externalOrderId: string | null;
  documentNumber: string;
  status: string;
  version: number;
  timestamp: string;
};

const canonicalStringify = (obj: Record<string, unknown>): string => {
  const sortedKeys = Object.keys(obj).sort();
  const sortedObj: Record<string, unknown> = {};
  for (const key of sortedKeys) sortedObj[key] = obj[key];
  return JSON.stringify(sortedObj);
};

/**
 * Performs one delivery attempt for an immutable outbox payload. Retry and
 * stale-claim recovery belong to the PostgreSQL outbox dispatcher.
 */
export async function deliverOrderStatusWebhook(
  payload: OrderStatusWebhookPayload,
): Promise<void> {
  const webhookUrl = process.env.SITE_WEBHOOK_URL || '';
  const webhookSecret = process.env.WEBHOOK_SECRET || '';
  if (!webhookUrl) throw new Error('SITE_WEBHOOK_URL is not configured');
  if (!webhookSecret) throw new Error('WEBHOOK_SECRET is not configured');

  const payloadString = canonicalStringify(payload);
  const signature = crypto
    .createHmac('sha256', webhookSecret)
    .update(payloadString)
    .digest('hex');

  console.log(`Sending order status outbox event ${payload.eventId}`);
  const response = await axios.post(webhookUrl, payload, {
    headers: {
      'Content-Type': 'application/json',
      'X-Webhook-Signature': signature,
    },
    timeout: 10_000,
  });
  if (response.status < 200 || response.status >= 300) {
    throw new Error(`Website webhook returned HTTP ${response.status}`);
  }
  console.log(`Order status outbox event delivered: ${payload.eventId}`);
}
