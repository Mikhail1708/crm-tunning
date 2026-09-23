import assert from 'node:assert/strict';
import test from 'node:test';
import fs from 'node:fs';
import path from 'node:path';
import { authMiddleware, managerAccess } from '../src/middleware/auth.middleware';

const response = () => ({ code: 200, status(code: number) { this.code = code; return this; }, json() { return this; } });
test('manual status route keeps authentication before manager authorization', () => {
  const route = fs.readFileSync(path.join(__dirname, '../src/routes/saleDocuments.routes.ts'), 'utf8');
  assert.ok(route.indexOf('router.use(authMiddleware') < route.indexOf("router.patch('/:id/status'"));
  assert.match(route, /router\.patch\('\/:id\/status', managerAccess as any, updateOrderStatus as any\)/);
  const controller = fs.readFileSync(path.join(__dirname, '../src/controllers/saleDocuments.controller.ts'), 'utf8');
  assert.match(controller, /updateAuthoritativeOrderStatus\(prisma, documentId, orderStatus, \{ manual: true \}\)/);
});
test('missing authentication cannot reach manual status mutation', async () => {
  const res = response(); let next = false;
  await authMiddleware({ path: '/api/sale-documents/1/status', originalUrl: '/api/sale-documents/1/status', method: 'PATCH', headers: {}, cookies: {} } as any, res as any, () => { next = true; });
  assert.equal(res.code, 401); assert.equal(next, false);
});
for (const role of [undefined, 'viewer', 'manager', 'admin']) {
  test(`manual status role gate: ${role ?? 'unauthenticated'}`, async () => {
    const res = response(); let next = false;
    await managerAccess({ user: role ? { id: 1, role } : undefined } as any, res as any, () => { next = true; });
    assert.equal(next, role === 'manager' || role === 'admin');
    assert.equal(res.code, !role ? 401 : role === 'viewer' ? 403 : 200);
  });
}
