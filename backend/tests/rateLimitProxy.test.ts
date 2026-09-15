import assert from 'node:assert/strict';
import { test } from 'node:test';
import express from 'express';
import http from 'node:http';
import { AddressInfo } from 'node:net';
import { configureTrustProxy } from '../src/config/trustProxy';
import { authLimiter, orderLimiter, apiLimiter, globalLimiter } from '../src/middleware/rateLimit.middleware';

async function fixture(environment: string, remote: string, run: (request: (xff?: string) => Promise<any>) => Promise<void>, limiter?: any) {
  const app = express();
  configureTrustProxy(app, environment);
  app.use((req, _res, next) => {
    // Model the connection's peer, not a client-controlled production header.
    Object.defineProperty(req.socket, 'remoteAddress', { value: remote, configurable: true });
    next();
  });
  if (limiter) app.use(limiter);
  app.get('/', (req, res) => res.status(401).json({ ip: req.ip, ips: req.ips }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const request = (xff?: string): Promise<any> => new Promise((resolve, reject) => {
    http.get({ hostname: '127.0.0.1', port: (server.address() as AddressInfo).port, path: '/',
      headers: { ...(xff ? { 'X-Forwarded-For': xff } : {}), 'X-Real-IP': '192.0.2.250' } }, res => {
      let body = '';
      res.on('data', chunk => { body += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(body), headers: res.headers }));
    }).on('error', reject);
  });
  try { await run(request); }
  finally { await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
}

test('F12 direct development requests ignore forwarded headers', async () => {
  await fixture('development', '198.51.100.10', async request => {
    for (const xff of [undefined, '1.2.3.4', '1.2.3.4, 5.6.7.8']) {
      assert.equal((await request(xff)).body.ip, '198.51.100.10');
    }
  });
});

test('F12 production does not trust a non-loopback direct peer', async () => {
  await fixture('production', '198.51.100.11', async request => {
    assert.equal((await request('1.2.3.4, 5.6.7.8')).body.ip, '198.51.100.11');
  }, apiLimiter);
});

for (const remote of ['127.0.0.1', '::1', '::ffff:127.0.0.1']) {
  test(`F12 one trusted proxy ${remote} selects nginx-appended client only`, async () => {
    await fixture('production', remote, async request => {
      for (const xff of ['198.51.100.20', '1.2.3.4, 198.51.100.20', '1.2.3.4, 5.6.7.8, 198.51.100.20']) {
        const result = await request(xff);
        assert.equal(result.body.ip, '198.51.100.20');
        assert.deepEqual(result.body.ips, ['198.51.100.20']);
      }
    });
  });
}

test('F12 login spoof rotation shares a bucket; different real clients remain separate', async () => {
  await fixture('production', '127.0.0.1', async request => {
    for (let i = 0; i < 10; i++) assert.equal((await request(`192.0.2.${i + 1}, 198.51.100.30`)).status, 401);
    assert.equal((await request('1.2.3.4, 5.6.7.8, 198.51.100.30')).status, 429);
    assert.equal((await request('1.2.3.4, 198.51.100.31')).status, 401);
  }, authLimiter);
});

for (const [name, limiter] of [['order', orderLimiter], ['global', globalLimiter], ['api', apiLimiter]] as const) {
  test(`F12 ${name} uses the same bucket despite spoofed prefixes`, async () => {
    await fixture('production', '127.0.0.1', async request => {
      const first = await request('1.2.3.4, 198.51.100.40');
      const second = await request('5.6.7.8, 198.51.100.40');
      assert.equal(Number(second.headers['ratelimit-remaining']), Number(first.headers['ratelimit-remaining']) - 1);
      assert.equal(second.body.ip, '198.51.100.40');
    }, limiter);
  });
}

test('F12 IPv6 and IPv4-mapped client addresses are handled by Express', async () => {
  await fixture('production', '::1', async request => {
    for (const ip of ['2001:db8::42', '::ffff:198.51.100.42']) {
      assert.equal((await request(`1.2.3.4, ${ip}`)).body.ip, ip);
    }
  }, globalLimiter);
});

test('F12 direct limiter works without a proxy header', async () => {
  await fixture('development', '198.51.100.50', async request => {
    assert.equal((await request()).body.ip, '198.51.100.50');
  }, orderLimiter);
});
