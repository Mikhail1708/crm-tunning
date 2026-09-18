import assert from 'node:assert/strict';
import test from 'node:test';
import { webhookConfiguration } from '../src/config/webhook';

const env = { NODE_ENV: 'production', SITE_WEBHOOK_URL: 'https://swap38.ru/api/webhooks/crm/order-status', WEBHOOK_SECRET: 'fictional-secret-never-used-for-network' };
test('production public endpoint configuration accepted without any network request', () => {
  assert.equal(webhookConfiguration(env).url, env.SITE_WEBHOOK_URL);
});
for (const url of ['', 'bad-url', 'http://host.docker.internal:5001/api/webhooks/crm/order-status',
  'https://host.docker.internal/api/webhooks/crm/order-status', 'http://swap38.ru/api/webhooks/crm/order-status',
  'https://swap38.ru/wrong', 'https://user:password@swap38.ru/api/webhooks/crm/order-status']) {
  test(`production rejects invalid endpoint ${url.split('@').pop()}`, () => {
    assert.throws(() => webhookConfiguration({ ...env, SITE_WEBHOOK_URL: url }), error => {
      assert.ok(!String(error).includes(env.WEBHOOK_SECRET)); return true;
    });
  });
}
test('production rejects missing/placeholder secret and development permits local HTTP', () => {
  for (const secret of ['', ' ', 'replace-with-a-secret']) assert.throws(() => webhookConfiguration({ ...env, WEBHOOK_SECRET: secret }));
  assert.equal(webhookConfiguration({ ...env, NODE_ENV: 'development', SITE_WEBHOOK_URL: 'http://localhost:5001/api/webhooks/crm/order-status' }).url.startsWith('http:'), true);
});
