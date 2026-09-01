import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import crypto from 'crypto';
import {
  deliverOrderStatusWebhook,
  OrderStatusWebhookPayload,
} from '../src/services/webhook.service';

const payload: OrderStatusWebhookPayload = {
  eventId: 'crm-order-status:42:v3',
  crmOrderId: 42,
  externalOrderId: 'website-order-42',
  documentNumber: 'ORDER-42',
  status: 'shipped',
  version: 3,
  timestamp: '2026-08-31T00:00:00.000Z',
};

test('webhook sender signs and sends the immutable outbox payload once', async () => {
  const originalPost = axios.post;
  process.env.SITE_WEBHOOK_URL = 'http://site.test/api/webhooks/crm/order-status';
  process.env.WEBHOOK_SECRET = 'shared-test-secret';

  let request: { url?: string; body?: any; config?: any } = {};
  let attempts = 0;
  (axios.post as any) = async (url: string, body: any, config: any) => {
    attempts += 1;
    request = { url, body, config };
    return { status: 200 };
  };

  try {
    await deliverOrderStatusWebhook(payload);
    assert.equal(attempts, 1);
    assert.deepEqual(request.body, payload);
    const canonicalPayload = Object.keys(payload).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = payload[key as keyof OrderStatusWebhookPayload];
      return result;
    }, {});
    const expectedSignature = crypto
      .createHmac('sha256', 'shared-test-secret')
      .update(JSON.stringify(canonicalPayload))
      .digest('hex');
    assert.equal(request.config.headers['X-Webhook-Signature'], expectedSignature);
  } finally {
    axios.post = originalPost;
  }
});
test('webhook sender leaves retry ownership to the durable dispatcher', async () => {
  const originalPost = axios.post;
  process.env.SITE_WEBHOOK_URL = 'http://site.test/api/webhooks/crm/order-status';
  process.env.WEBHOOK_SECRET = 'shared-test-secret';
  let attempts = 0;
  (axios.post as any) = async () => {
    attempts += 1;
    throw new Error('temporary outage');
  };

  try {
    await assert.rejects(deliverOrderStatusWebhook(payload), /temporary outage/);
    assert.equal(attempts, 1);
  } finally {
    axios.post = originalPost;
  }
});
