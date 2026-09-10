import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

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
  return id === '@prisma/client'
    ? { Prisma, PrismaClient: function () { return proxy; } }
    : originalLoad.call(this, id, ...args);
};
let documents: typeof import('../src/controllers/saleDocuments.controller');
let products: typeof import('../src/controllers/products.controller');
try {
  documents = require('../src/controllers/saleDocuments.controller');
  products = require('../src/controllers/products.controller');
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

test('create and both document update handlers reject zero/negative quantities before any Prisma call', async () => {
  db = new Proxy({}, { get: () => assert.fail('invalid items must not access the database') });
  for (const quantity of [0, -1, 1.5, '1', null]) {
    for (const handler of [documents.createSaleDocument, documents.updateFullOrder, documents.updateSaleDocument]) {
      const response = await invoke(handler, { items: [{ productId: 1, quantity, price: 100 }] });
      assert.equal(response.statusCode, 400);
      assert.equal(response.body.code, 'INVALID_QUANTITY');
    }
  }
});

test('public order rejects zero/negative quantities without creating a sale', async () => {
  db = new Proxy({}, { get: () => assert.fail('invalid public items reached Prisma') });
  for (const quantity of [0, -1]) {
    const response = await invoke(documents.createPublicOrder, {
      externalOrderId: 'website-order-1', items: [{ productId: 1, quantity }], client: { phone: '123' },
    });
    assert.equal(response.statusCode, 400);
  }
});

test('createSaleDocument maps a lost stock race to 409 before inserting financial rows', async () => {
  let stock = 1;
  let financialWrites = 0;
  db = {
    product: { findMany: async () => [{ id: 1, stock: 1, cost_price: 50, name: 'Last item', article: 'A' }] },
    $transaction: async (run: Function) => {
      stock = 0; // Another sale/reservation committed after the advisory catalogue read.
      return run({
        $queryRaw: async () => [{ id: 1 }],
        product: { updateMany: async ({ where }: any) => ({ count: stock >= where.stock.gte ? 1 : 0 }) },
        saleDocument: { create: async () => { financialWrites++; } },
        sale: { createMany: async () => { financialWrites++; } },
      });
    },
  };
  const response = await invoke(documents.createSaleDocument, { items: [{ productId: 1, quantity: 1, price: 100 }] });
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'INSUFFICIENT_STOCK');
  assert.equal(financialWrites, 0);
  assert.equal(stock, 0);
});

for (const relation of ['sale', 'saleDocumentItem', 'priceHistory', 'inventoryReservationItem']) {
  test(`deleteProduct preserves Product and ${relation} history with a 409`, async () => {
    let deleted = false;
    const tx: any = {
      $queryRaw: async () => [{ id: 1 }],
      product: { findUnique: async () => ({ id: 1 }), delete: async () => { deleted = true; } },
    };
    for (const name of ['sale', 'saleDocumentItem', 'priceHistory', 'inventoryReservationItem']) {
      tx[name] = { count: async () => name === relation ? 1 : 0 };
    }
    db = { $transaction: (run: Function) => run(tx) };
    const response = await invoke(products.deleteProduct, {});
    assert.equal(response.statusCode, 409);
    assert.equal(response.body.code, 'PRODUCT_HAS_HISTORY');
    assert.equal(deleted, false);
    assert.equal(await tx[relation].count(), 1);
  });
}

test('deleteProduct handles a database FK restriction as a business conflict', async () => {
  db = { $transaction: async () => { throw Object.assign(new Error('foreign key'), { code: 'P2003' }); } };
  const response = await invoke(products.deleteProduct, {});
  assert.equal(response.statusCode, 409);
  assert.equal(response.body.code, 'PRODUCT_HAS_HISTORY');
});

test('product stock rejects negatives and fractions before persistence', async () => {
  db = new Proxy({}, { get: () => assert.fail('invalid stock reached Prisma') });
  for (const stock of [-1, 1.5, '1']) {
    for (const handler of [products.createProduct, products.updateProduct]) {
      assert.equal((await invoke(handler, { stock })).statusCode, 400);
    }
  }
});

test('a metadata-only product edit does not restore the old stock snapshot', async () => {
  let updateData: any;
  let locked = false;
  db = { $transaction: (run: Function) => run({
    $queryRaw: async () => { locked = true; return [{ id: 1 }]; },
    product: {
      findUnique: async () => { assert.equal(locked, true); return { id: 1, stock: 1, retail_price: 100 }; },
      update: async ({ data }: any) => { updateData = data; return { id: 1, ...data }; },
    },
  }) };
  assert.equal((await invoke(products.updateProduct, { name: 'New name' })).statusCode, 200);
  assert.equal(updateData.stock, undefined);
});
