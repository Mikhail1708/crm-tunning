import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

let db: any;
const Module = require('node:module');
const originalLoad = Module._load;
const proxy = new Proxy({}, { get: (_target, key) => db[key] });
Module._load = function (id: string, ...args: any[]) {
  return id === '@prisma/client' ? { Prisma, PrismaClient: function () { return proxy; } } : originalLoad.call(this, id, ...args);
};
let lifecycle: typeof import('../src/services/orderLifecycle.service');
let inventory: typeof import('../src/controllers/inventoryReservations.controller');
try {
  lifecycle = require('../src/services/orderLifecycle.service');
  inventory = require('../src/controllers/inventoryReservations.controller');
} finally { Module._load = originalLoad; }

function model(status = 'consumed', orderStatus = 'confirmed') {
  let state: any = {
    stock: 0, increments: 0, events: [],
    document: { id: 1, source: 'website', externalOrderId: 'web-1', documentNumber: 'WEB-1',
      orderStatus, statusVersion: 0, cancellationRequestId: null, paymentStatus: 'paid', total: 100,
      paidAmountMinor: 10000n, paymentCurrency: 'RUB' },
    reservation: { id: 'res-1', externalOrderId: 'web-1', saleDocumentId: status === 'consumed' ? 1 : null,
      status, currency: 'RUB', totalMinor: 10000n, paidAmountMinor: 10000n, paymentId: 'pay-1',
      expiresAt: new Date(Date.now() + 600000), items: [{ productId: 1, quantity: 1, unitPriceMinor: 10000n, totalMinor: 10000n }] },
  };
  let failOutbox = false;
  const tx: any = {
    $queryRaw: async (strings: TemplateStringsArray) => strings.join('').includes('SELECT id, name')
      ? [{ id: 1, stock: state.stock, name: 'Last unit', article: 'A', retail_price: 100, cost_price: 50 }] : [],
    saleDocument: {
      findUnique: async () => structuredClone(state.document),
      update: async ({ data }: any) => {
        for (const [key, value] of Object.entries(data)) if (value !== undefined) {
          state.document[key] = key === 'statusVersion' ? state.document[key] + (value as any).increment : value;
        }
        return structuredClone(state.document);
      },
    },
    saleDocumentItem: { findMany: async () => [{ productId: 1, quantity: 1 }] },
    inventoryReservation: {
      findUnique: async ({ where }: any) => {
        const r = state.reservation;
        if (!r || (where.saleDocumentId && r.saleDocumentId !== where.saleDocumentId)
          || (where.externalOrderId && r.externalOrderId !== where.externalOrderId)) return null;
        return structuredClone({ ...r, saleDocument: r.saleDocumentId ? state.document : null });
      },
      update: async ({ data }: any) => { Object.assign(state.reservation, data); return structuredClone(state.reservation); },
      create: async ({ data }: any) => {
        state.reservation = { ...data, id: 'res-new', status: 'active', items: data.items.create };
        return structuredClone(state.reservation);
      },
    },
    product: {
      update: async ({ data }: any) => { state.stock += data.stock.increment; state.increments++; return {}; },
      updateMany: async ({ where, data }: any) => {
        if (state.stock < where.stock.gte) return { count: 0 };
        state.stock -= data.stock.decrement; return { count: 1 };
      },
    },
    crmStatusOutboxEvent: { upsert: async ({ create }: any) => {
      if (failOutbox) throw new Error('outbox unavailable');
      if (!state.events.some((e: any) => e.id === create.id)) state.events.push(create);
    } },
  };
  let tail = Promise.resolve();
  db = { ...tx, $transaction: (run: Function) => {
    const next = tail.then(async () => { const before = structuredClone(state); try { return await run(tx); } catch (e) { state = before; throw e; } });
    tail = next.then(() => undefined, () => undefined); return next;
  } };
  return { state: () => state, failOutbox: (value: boolean) => { failOutbox = value; } };
}
const cancel = (requestId = 'cancel-1') => lifecycle.decideWebsiteCancellation(db, {
  saleDocumentId: 1, externalOrderId: 'web-1', requestId, reason: null,
});
async function invoke(handler: Function, params: any = { reservationId: 'res-1' }, body: any = {}) {
  const res: any = { code: 200, status(n: number) { this.code = n; return this; }, json(value: any) { this.body = value; } };
  await handler({ params, body }, res); return res;
}

test('consumed cancellation restores once and preserves consumed quote and financial history', async () => {
  const m = model(); const before = structuredClone(m.state().reservation);
  assert.equal((await cancel()).decision, 'accepted');
  assert.equal((await cancel()).idempotent, true);
  await lifecycle.updateAuthoritativeOrderStatus(db, 1, 'cancelled');
  assert.equal(m.state().stock, 1); assert.equal(m.state().increments, 1); assert.equal(m.state().events.length, 1);
  assert.deepEqual(m.state().reservation, before); assert.equal(m.state().document.total, 100);
  assert.equal((await invoke(inventory.releaseInventoryReservation)).code, 409);
  assert.equal(m.state().stock, 1);
});

test('manual cancellation and website cancellation race restores exactly once', async () => {
  const m = model();
  await Promise.all([lifecycle.updateAuthoritativeOrderStatus(db, 1, 'cancelled'), cancel()]);
  assert.equal(m.state().stock, 1); assert.equal(m.state().increments, 1); assert.equal(m.state().events.length, 1);
});

test('outbox failure rolls back stock and status; retry commits one compensation', async () => {
  const m = model(); m.failOutbox(true);
  await assert.rejects(cancel(), /outbox unavailable/);
  assert.equal(m.state().stock, 0); assert.equal(m.state().document.orderStatus, 'confirmed');
  m.failOutbox(false); await cancel(); assert.equal(m.state().increments, 1);
});

test('legacy website cancellation restores its document items once', async () => {
  const m = model(); m.state().reservation = null;
  await cancel(); await cancel(); assert.equal(m.state().increments, 1);
});

test('shipped order and invalid identity reject without stock or callback effects', async () => {
  const m = model('consumed', 'shipped'); assert.equal((await cancel()).decision, 'rejected');
  assert.equal(m.state().stock, 0); assert.equal(m.state().events.length, 0);
  await assert.rejects(lifecycle.decideWebsiteCancellation(db, { saleDocumentId: 1, externalOrderId: 'wrong', requestId: 'bad', reason: null }));
  assert.equal(m.state().increments, 0);
});

test('conflicting consumed reservation identity fails closed without restock', async () => {
  const m = model(); m.state().reservation.externalOrderId = 'other';
  await assert.rejects(cancel(), /matching consumed/); assert.equal(m.state().increments, 0);
});

test('normal successful order advancing to shipped never restores stock', async () => {
  const m = model();
  await lifecycle.updateAuthoritativeOrderStatus(db, 1, 'assembling');
  await lifecycle.updateAuthoritativeOrderStatus(db, 1, 'shipped');
  assert.equal(m.state().stock, 0); assert.equal(m.state().increments, 0);
});

test('active cancellation/release race returns stock once and allows another reservation', async () => {
  const m = model('active');
  const replies = await Promise.all([invoke(inventory.releaseInventoryReservation), invoke(inventory.releaseInventoryReservation)]);
  assert.ok(replies.every(r => r.code === 200)); assert.equal(m.state().increments, 1);
  const result = await invoke(inventory.createInventoryReservation, {}, { externalOrderId: 'web-2', currency: 'RUB', items: [{ productId: 1, quantity: 1 }] });
  assert.equal(result.code, 201); assert.equal(m.state().stock, 0); assert.equal(m.state().increments, 1);
});

for (const status of ['expired', 'released']) test(`${status} reservation never returns stock twice`, async () => {
  const m = model(status); m.state().stock = 1;
  await invoke(inventory.releaseInventoryReservation); await invoke(inventory.releaseInventoryReservation);
  assert.equal(m.state().stock, 1); assert.equal(m.state().increments, 0);
});

test('late consume replay of a cancelled consumed order preserves stock and returns cancelled document', async () => {
  const m = model(); await cancel();
  const result = await invoke(inventory.consumeInventoryReservation, { reservationId: 'res-1' }, {
    externalOrderId: 'web-1', paymentId: 'pay-1', paidAmountMinor: 10000, currency: 'RUB',
    items: [{ productId: 1, quantity: 1 }], client: { phone: '123' },
  });
  assert.equal(result.code, 200); assert.equal(result.body.orderStatus, 'cancelled');
  assert.equal(m.state().stock, 1); assert.equal(m.state().increments, 1);
});
