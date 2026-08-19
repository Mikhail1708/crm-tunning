import test from 'node:test';
import assert from 'node:assert/strict';
import axios from 'axios';
import crypto from 'crypto';
import { sendOrderStatusWebhook } from '../src/services/webhook.service';

test('webhook sender reads dotenv-backed configuration at call time', async () => {
  const originalPost = axios.post;
  process.env.SITE_WEBHOOK_URL = 'http://site.test/api/webhooks/crm/order-status';
  process.env.WEBHOOK_SECRET = 'shared-test-secret';
  process.env.WEBHOOK_MAX_ATTEMPTS = '1';

  let request: { url?: string; body?: any; config?: any } = {};
  (axios.post as any) = async (url: string, body: any, config: any) => {
    request = { url, body, config };
    return { status: 200 };
  };

  try {
    const delivered = await sendOrderStatusWebhook(42, 'shipped', 'ORDER-42', 3);
    assert.equal(delivered, true);
    assert.equal(request.url, process.env.SITE_WEBHOOK_URL);

    const canonicalPayload = Object.keys(request.body).sort().reduce<Record<string, unknown>>((result, key) => {
      result[key] = request.body[key];
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

test('webhook sender retries a temporary order-not-found race', async () => {
  const originalPost = axios.post;
  process.env.SITE_WEBHOOK_URL = 'http://site.test/api/webhooks/crm/order-status';
  process.env.WEBHOOK_SECRET = 'shared-test-secret';
  process.env.WEBHOOK_MAX_ATTEMPTS = '3';
  process.env.WEBHOOK_RETRY_BASE_MS = '50';

  let attempts = 0;
  (axios.post as any) = async () => {
    attempts += 1;
    if (attempts === 1) {
      const error: any = new Error('Order is not linked yet');
      error.response = { status: 404 };
      throw error;
    }
    return { status: 200 };
  };

  try {
    const delivered = await sendOrderStatusWebhook(42, 'assembling', 'ORDER-42', 1);
    assert.equal(delivered, true);
    assert.equal(attempts, 2);
  } finally {
    axios.post = originalPost;
  }
});
