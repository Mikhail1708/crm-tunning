import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import express from 'express';
import { AddressInfo } from 'net';
import { isPaidWebsiteOrder } from '../src/services/paidWebsiteOrder.service';

// Load real controllers against an in-memory Prisma boundary. No database or workers.
const Module = require('node:module');
const originalLoad = Module._load;
const originalInterval = global.setInterval;
const importTimers: ReturnType<typeof setInterval>[] = [];
global.setInterval = ((...args: any[]) => {
  const timer = (originalInterval as any)(...args);
  importTimers.push(timer);
  return timer;
}) as typeof setInterval;
let db: any;
const proxy = new Proxy({}, { get: (_target, key) => db[key] });
Module._load = function (id: string, ...args: any[]) {
  if (id.endsWith('/middleware/auth.middleware')) return { authMiddleware: (req: any, _res: any, next: Function) => { req.user = { id: 1, role: 'manager' }; next(); }, managerAccess: (_req: any, _res: any, next: Function) => next() };
  if (id.endsWith('/middleware/internalApiKey.middleware')) return { requireInternalApiKey: (req: any, _res: any, next: Function) => { req.internalService = true; next(); } };
  return id === '@prisma/client'
    ? { Prisma, PrismaClient: function () { return proxy; } }
    : originalLoad.call(this, id, ...args);
};
let documents: typeof import('../src/controllers/saleDocuments.controller');
let router: any;
let cancellation: typeof import('../src/controllers/internalCancellation.controller');
try {
  documents = require('../src/controllers/saleDocuments.controller');
  cancellation = require('../src/controllers/internalCancellation.controller');
  router = require('../src/routes/saleDocuments.routes').default;
} finally {
  Module._load = originalLoad;
  global.setInterval = originalInterval;
  // The controller's cache cleanup timer is unrelated to these requests.
  for (const timer of importTimers) clearInterval(timer);
}

const invoke = async (handler: Function, body: any, id = '1') => {
  const response = {
    statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(value: any) { this.body = value; return this; },
  };
  await handler({ body, params: { id }, user: { id: 1, name: 'Manager', role: 'manager' } }, response);
  return response;
};

const paid = (): any => ({ id: 1, documentNumber: 'WEB-1', source: 'website', externalOrderId: 'website-1',
  externalPaymentId: null, paidAmountMinor: null, inventoryReservation: null, paymentStatus: 'paid',
  orderStatus: 'confirmed', statusVersion: 0, cancellationRequestId: null, clientId: null, total: 100,
  description: 'note', items: [{ productId: 1, quantity: 1, price: 100 }] });

function store(document = paid()) {
  const state = { document: structuredClone(document), stock: 5, items: structuredClone(document.items), sales: [] as any[], events: [] as any[] };
  const calls: string[] = [];
  const patch = (data: any) => { calls.push('write'); for (const [key, value] of Object.entries(data)) {
    if (value !== undefined) state.document[key] = key === 'statusVersion' ? state.document[key] + (value as any).increment : value;
  } return state.document; };
  const tx: any = {
    $queryRaw: async () => { calls.push('lock'); return []; },
    saleDocument: {
      findUnique: async () => { calls.push('read'); return structuredClone(state.document); },
      findUniqueOrThrow: async () => state.document,
      update: async ({ data }: any) => patch(data),
      updateMany: async ({ data }: any) => { patch(data); return { count: 1 }; },
      delete: async () => { calls.push('delete'); },
    },
    product: {
      update: async ({ data }: any) => { state.stock += data.stock.increment; },
      findMany: async () => [{ id: 1, stock: state.stock, name: 'Product', article: 'A', cost_price: 50 }],
      updateMany: async ({ data }: any) => { calls.push('stock'); state.stock -= data.stock.decrement; return { count: 1 }; },
    },
    saleDocumentItem: { findMany: async () => state.items, deleteMany: async () => { calls.push('items'); state.items = []; }, createMany: async ({ data }: any) => { state.items = data; } },
    inventoryReservation: { findUnique: async () => null },
    sale: { deleteMany: async () => { calls.push('sales'); state.sales = []; }, createMany: async ({ data }: any) => { state.sales = data; } },
    crmStatusOutboxEvent: { upsert: async ({ create }: any) => { state.events.push(create); } },
  };
  db = { ...tx, $transaction: async (run: Function) => run(tx) };
  return { state, calls };
}

test('persisted legacy, refunded, payment and consumed reservation facts are fail-closed', () => {
  for (const extra of [{}, { paymentStatus: 'refunded' },
    { source: null, externalOrderId: null, paymentStatus: 'unpaid', externalPaymentId: 'p1' },
    { paymentStatus: 'failed', paidAmountMinor: 0n },
    { source: null, externalOrderId: null, paymentStatus: 'unpaid', inventoryReservation: { status: 'consumed', paymentId: null, paidAmountMinor: null } },
    { paymentStatus: 'unpaid', inventoryReservation: { status: 'active', paymentId: 'p1', paidAmountMinor: 100n } },
  ]) assert.equal(isPaidWebsiteOrder({ ...paid(), ...extra }), true);
  assert.equal(isPaidWebsiteOrder({ ...paid(), source: 'instore', externalOrderId: null }), false);
  assert.equal(isPaidWebsiteOrder({ ...paid(), paymentStatus: 'unpaid' }), false);
});

for (const [label, body] of Object.entries({
  items: { items: [{ productId: 2, quantity: 1, price: 100 }] },
  quantity: { items: [{ productId: 1, quantity: 2, price: 100 }] },
  price: { items: [{ productId: 1, quantity: 1, price: 1 }] }, total: { total: 1 },
  identity: { source: 'instore', externalOrderId: null, externalPaymentId: null, paidAmountMinor: null, paymentStatus: 'unpaid' },
  customer: { clientId: 2, customerAddress: 'Changed' }, delivery: { deliveryMethod: 'pickup' }, lifecycle: { orderStatus: 'cancelled' },
})) test(`paid website ${label} edits reject before any mutation through both handlers`, async () => {
  for (const handler of [documents.updateSaleDocument, documents.updateFullOrder]) {
    const { state, calls } = store(); const before = structuredClone(state);
    const response = await invoke(handler, handler === documents.updateFullOrder ? { items: paid().items, ...body } : body);
    assert.equal(response.statusCode, 409); assert.equal(response.body.code, 'PAID_ORDER_IMMUTABLE');
    assert.deepEqual(state, before); assert.deepEqual(calls, ['lock', 'read']);
  }
});

test('paid website delete cannot bypass cancellation', async () => {
  const { state, calls } = store(); const before = structuredClone(state);
  const response = await invoke(documents.deleteSaleDocument, {});
  assert.equal(response.statusCode, 409); assert.equal(response.body.code, 'PAID_ORDER_IMMUTABLE');
  assert.deepEqual(state, before); assert.deepEqual(calls, ['lock', 'read']);
});

test('description-only update preserves paid facts', async () => {
  const { state } = store(); const before = structuredClone(state);
  assert.equal((await invoke(documents.updateSaleDocument, { description: 'Internal note' })).statusCode, 200);
  before.document.description = 'Internal note'; assert.deepEqual(state, before);
});

test('unpaid instore header and full edit still work', async () => {
  const { state } = store({ ...paid(), source: 'instore', externalOrderId: null, paymentStatus: 'unpaid' });
  assert.equal((await invoke(documents.updateSaleDocument, { customerName: 'Customer' })).statusCode, 200);
  assert.equal(state.document.customerName, 'Customer');
  const response = await invoke(documents.updateFullOrder, { items: [{ productId: 1, quantity: 2, price: 75 }], discount: 10 });
  assert.equal(response.statusCode, 200); assert.equal(state.document.total, 140);
  assert.equal(state.stock, 4); assert.equal(state.items[0].quantity, 2);
});

test('persisted payment cannot be bypassed by stale unpaid payload', async () => {
  const { calls } = store({ ...paid(), paymentStatus: 'pending', paidAmountMinor: 100n });
  assert.equal((await invoke(documents.updateSaleDocument, { paymentStatus: 'unpaid', description: 'stale' })).statusCode, 409);
  assert.deepEqual(calls, ['lock', 'read']);
});

test('dedicated refund status transition never unlocks legacy full edit', async () => {
  const { state } = store();
  assert.equal((await invoke(documents.updatePaymentStatus, { paymentStatus: 'refunded' })).statusCode, 200);
  assert.equal(state.document.paymentStatus, 'refunded');
  assert.equal((await invoke(documents.updateFullOrder, { items: paid().items })).statusCode, 409);
});

test('paid status processing and cancellation still enqueue outbox events idempotently', async () => {
  const { state } = store();
  assert.equal((await invoke(documents.updateOrderStatus, { orderStatus: 'assembling' })).statusCode, 200);
  assert.equal(state.events[0].payload.status, 'assembling');
  const response: any = { code: 200, status(n: number) { this.code = n; return this; }, json(body: any) { this.body = body; } };
  const request: any = { params: { crmOrderId: '1' }, body: { requestId: 'cancel-1', externalOrderId: 'website-1' } };
  await cancellation.cancelWebsiteOrder(request, response);
  assert.equal(response.code, 200); assert.equal(response.body.decision, 'accepted');
  assert.equal(state.events[1].payload.status, 'cancelled');
  await cancellation.cancelWebsiteOrder(request, response);
  assert.equal(response.body.idempotent, true); assert.equal(state.events.length, 2);
  assert.equal(state.document.paymentStatus, 'paid'); assert.equal(state.document.total, 100);
});

test('HTTP manager and internal full routes reject payloads without payment fields', async () => {
  const { state } = store(); const before = structuredClone(state);
  const app = express(); app.use(express.json()); app.use('/api/sale-documents', router);
  const server = app.listen(0, '127.0.0.1'); await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    for (const route of ['/1', '/1/full', '/internal/1/full']) {
      const response = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/sale-documents${route}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ items: paid().items, total: 1 }),
      });
      assert.equal(response.status, 409); assert.equal((await response.json() as any).code, 'PAID_ORDER_IMMUTABLE');
    } assert.deepEqual(state, before);
  } finally { server.closeAllConnections(); await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve())); }
});
