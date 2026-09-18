import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { Prisma } from '@prisma/client';
import jwt from 'jsonwebtoken';
import { CRM_AUTH_COOKIE, CRM_JWT_AUDIENCE, CRM_JWT_ISSUER } from '../src/utils/authCookie';

// Execute real restore/auth handlers; all persistence is confined to this in-memory DB.
const Module = require('node:module');
const originalLoad = Module._load;
const oldGeneration = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const secret = 'f31-restore-fictional-test-secret-at-least-32-bytes';
const previousSecret = process.env.JWT_SECRET;
let users: any[] = [];
let created: any[] = [];
let deleted: any[] = [];
const emptyDelegate = { deleteMany: async () => ({ count: 0 }), create: async () => ({}), count: async () => 0 };
const tx: any = {
  user: {
    deleteMany: async (args: any) => {
      deleted.push(args);
      users = users.filter(user => user.role === 'admin');
      return { count: 1 };
    },
    findFirst: async () => users.find(user => user.role === 'admin') || null,
    findMany: async () => users.filter(user => user.role === 'admin'),
    findUnique: async ({ where }: any) => users.find(user => user.id === where.id) || null,
    create: async ({ data }: any) => { created.push(data); users.push({ ...data }); return data; },
  },
  $executeRaw: async () => 0,
  $queryRaw: async () => [{ next: 10 }],
};
for (const name of ['saleDocumentItem', 'sale', 'productCharacteristic', 'productCategory', 'saleDocument', 'expense', 'client', 'product', 'categoryField', 'category', 'inventoryReservation', 'inventoryReservationItem', 'crmStatusOutboxEvent', 'productImage', 'priceHistory']) tx[name] = emptyDelegate;
const db = { ...tx, $transaction: async (callback: Function) => callback(tx) };
Module._load = function(id: string, ...args: any[]) {
  if (id === '@prisma/client') return { Prisma, PrismaClient: function() { return db; } };
  return originalLoad.call(this, id, ...args);
};
let restoreDatabase: any, authMiddleware: any;
try {
  ({ restoreDatabase } = require('../src/controllers/reports.controller'));
  ({ authMiddleware } = require('../src/middleware/auth.middleware'));
} finally { Module._load = originalLoad; }

beforeEach(() => { users = []; created = []; deleted = []; process.env.JWT_SECRET = secret; });
after(() => { if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret; });

const user = () => ({ id: 7, email: 'manager@example.test', name: 'Manager', role: 'manager', password: 'fictional-hash', createdAt: '2026-01-01T00:00:00.000Z' });
const response = () => ({ statusCode: 200, body: undefined as any,
  status(code: number) { this.statusCode = code; return this; },
  json(body: any) { this.body = body; return this; },
});
async function restore(dumpUsers: any[]) {
  const data: any = { users: dumpUsers };
  for (const field of ['categories', 'categoryFields', 'products', 'productCategories', 'productCharacteristics', 'clients', 'saleDocuments', 'saleDocumentItems', 'sales', 'expenses']) data[field] = [];
  const res = response();
  const originalLog = console.log;
  console.log = () => {};
  try { await restoreDatabase({ user: { id: 1, role: 'admin' }, body: { version: '3.0', legacyRuntimePolicy: 'require-empty', data } }, res); }
  finally { console.log = originalLog; }
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.success, true);
  return res;
}
function assertGeneration(value: any) {
  assert.match(value, /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
  assert.notEqual(value, oldGeneration);
}
for (const [label, generation] of [['legacy dump without generation', undefined], ['dump with old generation', oldGeneration], ['dump with malformed generation', { injected: true }]] as const) {
  test(`F31 restore ${label} creates fresh auth generation and preserves user data`, async () => {
    const original: any = user();
    if (generation !== undefined) original.authGeneration = generation;
    await restore([original]);
    assert.equal(created.length, 1);
    assertGeneration(created[0].authGeneration);
    const { authGeneration, ...restoredFields } = created[0];
    assert.deepEqual(restoredFields, user());
    assert.equal(original.authGeneration, generation, 'restore must not mutate the backup object');
    assert.deepEqual(deleted, [{ where: { role: { not: 'admin' } } }]);
  });
}

test('F31 repeated restore of the same dump never reuses a previous generation', async () => {
  const original = { ...user(), authGeneration: oldGeneration };
  await restore([original]);
  const first = created[0].authGeneration;
  await restore([original]);
  assertGeneration(created[1].authGeneration);
  assert.notEqual(created[1].authGeneration, first);
});

test('F31 restore preserves existing admin and skips admin from dump', async () => {
  const admin = { ...user(), id: 1, role: 'admin', authGeneration: oldGeneration };
  users = [admin];
  await restore([{ ...admin, password: 'backup-admin-hash' }, user()]);
  assert.equal(created.length, 1);
  assert.equal(created[0].role, 'manager');
  assert.deepEqual(users.find(value => value.id === 1), admin);
});

test('F31 restore creates fresh generation for restored admin when no admin exists', async () => {
  await restore([{ ...user(), role: 'admin', authGeneration: oldGeneration }]);
  assert.equal(created.length, 1);
  assert.equal(created[0].role, 'admin');
  assertGeneration(created[0].authGeneration);
});

test('F31 real restore of same ID cannot resurrect an old signed JWT', async () => {
  const original = { ...user(), authGeneration: oldGeneration };
  users = [{ ...original }];
  const oldToken = jwt.sign({ id: original.id, role: original.role, authGeneration: oldGeneration }, secret,
    { algorithm: 'HS256', expiresIn: '24h', issuer: CRM_JWT_ISSUER, audience: CRM_JWT_AUDIENCE });
  async function authenticate() {
    const res = response(); let passed = false;
    await authMiddleware({ cookies: { [CRM_AUTH_COOKIE]: oldToken }, headers: {}, path: '/protected', originalUrl: '/api/protected' }, res, () => { passed = true; });
    return { passed, res };
  }
  assert.equal((await authenticate()).passed, true);
  users = [];
  assert.equal((await authenticate()).res.statusCode, 401);
  await restore([original]);
  assert.equal(users[0].id, original.id);
  const rejected = await authenticate();
  assert.equal(rejected.passed, false);
  assert.equal(rejected.res.statusCode, 401);
  assert.doesNotMatch(JSON.stringify(rejected.res.body), /authGeneration|aaaaaaaa|stack|prisma/i);
});
