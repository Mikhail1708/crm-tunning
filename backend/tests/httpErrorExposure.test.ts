import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import express from 'express';
import { AddressInfo } from 'node:net';
import { errorHandler } from '../src/middleware/error.middleware';

// Real handlers; every Prisma operation is an in-memory stub, including restore.
const Module = require('node:module');
const originalLoad = Module._load;
const originalInterval = global.setInterval;
const timers: any[] = [];
global.setInterval = ((...args: any[]) => { const timer = (originalInterval as any)(...args); timers.push(timer); return timer; }) as any;
let failure: any;
let calls = 0;
let missing = false;
const operation = async () => { calls++; if (missing) return null; throw failure; };
const delegate = new Proxy({}, { get: () => operation });
const db = new Proxy({}, { get: (_target, key) => key === '$transaction' ? operation : delegate });
Module._load = function(id: string, ...args: any[]) {
  if (id === '@prisma/client') return { Prisma, PrismaClient: function() { return db; } };
  if (id.endsWith('/services/audit.service')) return { __esModule: true, default: { log: async () => undefined } };
  return originalLoad.call(this, id, ...args);
};
let clients: any, products: any, documents: any, inventory: any, reports: any, categories: any, publicApi: any;
try {
  clients = require('../src/controllers/clients.controller');
  products = require('../src/controllers/products.controller');
  documents = require('../src/controllers/saleDocuments.controller');
  inventory = require('../src/controllers/inventoryReservations.controller');
  reports = require('../src/controllers/reports.controller');
  categories = require('../src/controllers/categories.controller');
  publicApi = require('../src/controllers/public.controller');
} finally {
  Module._load = originalLoad; global.setInterval = originalInterval; timers.forEach(clearInterval);
}
const body = { firstName: 'Client', phone: '123', discountPercent: 10, name: 'Product', stock: 1,
  cost_price: 10, retail_price: 20, items: [{ productId: 1, quantity: 1 }],
  externalOrderId: 'f27-order', currency: 'RUB', paymentId: 'payment', paidAmountMinor: 2000,
  client: { firstName: 'Client', phone: '123', email: 'client@example.test' },
  version: '3.0', data: {} };

async function invoke(handler: Function, override: any = {}) {
  const response = { statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; }, setHeader() {},
  };
  const oldError = console.error; const oldLog = console.log;
  console.error = () => {}; console.log = () => {};
  try { await handler({ body, params: { id: '1', reservationId: 'reservation-1' }, query: { q: 'client' },
    user: { id: 7, name: 'Admin', role: 'admin' }, ...override }, response); }
  finally { console.error = oldError; console.log = oldLog; }
  return response;
}

const cases: Array<[string, Function]> = [
  ...['getAllClients', 'getClientById', 'createClient', 'updateClient', 'deleteClient', 'searchClients', 'getClientsStats', 'updateClientDiscount'].map(name => [name, clients[name]] as [string, Function]),
  ['createProduct', products.createProduct], ['updateProduct', products.updateProduct],
  ['createSaleDocument', documents.createSaleDocument], ['updateFullOrder', documents.updateFullOrder], ['deleteSaleDocument', documents.deleteSaleDocument],
  ['createInventoryReservation', inventory.createInventoryReservation], ['releaseInventoryReservation', inventory.releaseInventoryReservation],
  ['expireInventoryReservations', inventory.expireInventoryReservations], ['consumeInventoryReservation', inventory.consumeInventoryReservation],
  ['restoreDatabase', reports.restoreDatabase], ['publicProducts', publicApi.getPublicProducts], ['publicOrder', documents.createPublicOrder],
];
for (const [name, handler] of cases) for (const kind of ['unknown', 'Prisma']) {
  test(`F27 ${name} hides ${kind} exception, stack and meta`, async () => {
    missing = false; calls = 0;
    failure = kind === 'Prisma'
      ? new Prisma.PrismaClientKnownRequestError('Invalid prisma.client.update() invocation SECRET_INTERNAL_DB_DETAIL', { code: 'P2025', clientVersion: 'test', meta: { constraint: 'SECRET_CONSTRAINT' } })
      : new Error('SECRET_INTERNAL_DB_DETAIL');
    failure.stack = 'SECRET_STACK /internal/server.ts';
    const res = await invoke(handler);
    assert.ok(calls > 0, 'test must reach the Prisma boundary');
    assert.equal(res.statusCode, 500);
    assert.doesNotMatch(JSON.stringify(res.body), /SECRET|prisma|constraint|stack|meta|invocation|internal\/server/i);
  });
}

test('F27 category P2002 keeps existing safe duplicate 400', async () => {
  missing = false;
  failure = new Prisma.PrismaClientKnownRequestError('SECRET_CONSTRAINT', { code: 'P2002', clientVersion: 'test', meta: { target: 'SECRET' } });
  const res = await invoke(categories.createCategory);
  assert.equal(res.statusCode, 400); assert.doesNotMatch(JSON.stringify(res.body), /SECRET/);
});
test('F27 consume P2002 keeps existing safe conflict 409', async () => {
  missing = false;
  failure = new Prisma.PrismaClientKnownRequestError('SECRET_CONSTRAINT', { code: 'P2002', clientVersion: 'test' });
  const res = await invoke(inventory.consumeInventoryReservation);
  assert.equal(res.statusCode, 409); assert.equal(res.body.message, 'Payment or order is already bound to another document');
});
test('F27 public P2002 recovery lookup failure stays a safe 500', async () => {
  missing = false; calls = 0;
  failure = new Prisma.PrismaClientKnownRequestError('SECRET_CONSTRAINT', { code: 'P2002', clientVersion: 'test' });
  const res = await invoke(documents.createPublicOrder);
  assert.ok(calls >= 2);
  assert.equal(res.statusCode, 500); assert.doesNotMatch(JSON.stringify(res.body), /SECRET|Prisma/);
});
test('F27 legacy stock conflict name cannot expose an arbitrary internal message', async () => {
  missing = false;
  failure = Object.assign(new Error('SECRET_INTERNAL_DB_DETAIL'), { name: 'InsufficientStockError' });
  const res = await invoke(documents.createPublicOrder);
  assert.equal(res.statusCode, 409); assert.doesNotMatch(JSON.stringify(res.body), /SECRET/);
});
test('F27 missing client retains intentional 404', async () => {
  missing = true;
  const res = await invoke(clients.getClientById);
  assert.equal(res.statusCode, 404); missing = false;
});
test('F27 invalid reservation payload retains intentional 400', async () => {
  const res = await invoke(inventory.createInventoryReservation, { body: {} });
  assert.equal(res.statusCode, 400); assert.equal(res.body.message, 'Invalid reservation payload');
});

test('F27 real HTTP next(error) and malformed JSON never expose internals', async () => {
  const app = express(); app.use(express.json());
  app.post('/', (_req, _res, next) => next(new Error('SECRET_INTERNAL_DB_DETAIL')));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}/`;
    for (const [payload, status] of [['{}', 500], ['{"SECRET_INPUT":', 400]] as const) {
      const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: payload });
      assert.equal(res.status, status); assert.doesNotMatch(await res.text(), /SECRET|stack|SyntaxError|Error:/);
    }
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
