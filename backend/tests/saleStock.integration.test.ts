import assert from 'node:assert/strict';
import test from 'node:test';
import { randomUUID } from 'node:crypto';
import { PrismaClient } from '@prisma/client';
import { deleteProductPreservingHistory } from '../src/services/productDeletion.service';

// Never inherit DATABASE_URL. This suite requires a separately provisioned,
// migrated database; it neither creates schemas nor applies migrations.
const enabled = process.env.RUN_SALE_STOCK_DB_TESTS === '1';

function isolatedUrl(): string {
  const value = process.env.SALE_STOCK_TEST_DATABASE_URL;
  assert.ok(value, 'SALE_STOCK_TEST_DATABASE_URL is required');
  const url = new URL(value);
  assert.ok(['postgres:', 'postgresql:'].includes(url.protocol), 'PostgreSQL URL required');
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname), 'Loopback host required');
  assert.equal(decodeURIComponent(url.pathname), '/crm_stock_test', 'Only crm_stock_test is allowed');
  // Do not allow query parameters to redirect libpq to a different host/database.
  for (const key of url.searchParams.keys()) {
    assert.ok(['schema', 'connection_limit', 'pool_timeout', 'connect_timeout'].includes(key),
      'Unsupported test datasource parameter');
  }
  assert.ok(!url.searchParams.has('schema') || url.searchParams.get('schema') === 'public',
    'Only the public test schema is allowed');
  return value;
}

test('PostgreSQL sale stock and historical product regressions', {
  skip: !enabled && 'requires RUN_SALE_STOCK_DB_TESTS=1 and isolated migrated crm_stock_test',
}, async t => {
  const db = new PrismaClient({ datasources: { db: { url: isolatedUrl() } } });
  const suffix = randomUUID();
  const products: number[] = [];
  const externalOrderIds: string[] = [];
  let user: { id: number; email: string; name: string; role: string } | undefined;
  const timers: ReturnType<typeof setInterval>[] = [];
  try {
    const identity = await db.$queryRaw<Array<{ database: string }>>`SELECT current_database() AS database`;
    assert.equal(identity[0].database, 'crm_stock_test');
    user = await db.user.create({ data: {
      email: `sale-stock-${suffix}@example.invalid`, name: `sale-stock-${suffix}`,
      password: 'unusable-test-fixture', role: 'manager',
    } });

    // Controllers own Prisma clients. Inject this explicitly isolated instance
    // while loading them synchronously, preserving all real Prisma operations.
    const Module = require('node:module') as any;
    const originalLoad = Module._load;
    const originalInterval = global.setInterval;
    const actualPrisma = require('@prisma/client');
    let releaseReads: (() => void) | undefined;
    let readsRemaining = 0;
    let readsBarrier: Promise<void> | undefined;
    const productDelegate = new Proxy(db.product, {
      get(target, property) {
        if (property === 'findMany') return async (...args: any[]) => {
          const result = await (target.findMany as any)(...args);
          if (readsRemaining > 0) {
            readsRemaining -= 1;
            if (readsRemaining === 0) releaseReads!();
            await readsBarrier;
          }
          return result;
        };
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    const injected = new Proxy(db, {
      get(target, property) {
        if (property === 'product') return productDelegate;
        const value = Reflect.get(target, property);
        return typeof value === 'function' ? value.bind(target) : value;
      },
    });
    let sales: typeof import('../src/controllers/saleDocuments.controller');
    let reservations: typeof import('../src/controllers/inventoryReservations.controller');
    try {
      Module._load = function (request: string, ...args: any[]) {
        if (request === '@prisma/client') return {
          ...actualPrisma, PrismaClient: function () { return injected; },
        };
        return originalLoad.call(this, request, ...args);
      };
      global.setInterval = ((...args: any[]) => {
        const timer = (originalInterval as any)(...args);
        timers.push(timer);
        timer.unref();
        return timer;
      }) as typeof setInterval;
      sales = require('../src/controllers/saleDocuments.controller');
      reservations = require('../src/controllers/inventoryReservations.controller');
    } finally {
      Module._load = originalLoad;
      global.setInterval = originalInterval;
    }

    async function product(stock = 1) {
      const row = await db.product.create({ data: {
        name: `sale-stock-${suffix}`, article: `sale-stock-${suffix}`,
        cost_price: 50, retail_price: 100, stock,
      } });
      products.push(row.id);
      return row;
    }
    async function invoke(handler: Function, body: any, params: Record<string, string> = {}) {
      let status = 200;
      let response: any;
      const res = {
        status(value: number) { status = value; return this; },
        json(value: any) { response = value; return this; },
      };
      await handler({ user, body, params }, res);
      return { status, body: response };
    }
    const saleBody = (productId: number, quantity = 1) => ({
      items: [{ productId, quantity, price: 100 }], paymentStatus: 'unpaid',
      customerName: `sale-stock-${suffix}`, documentType: 'order',
    });
    const stock = async (id: number) => (await db.product.findUniqueOrThrow({ where: { id } })).stock;

    await t.test('two actual sale requests cannot sell the final unit twice', async () => {
      const row = await product();
      readsRemaining = 2;
      readsBarrier = new Promise<void>(resolve => { releaseReads = resolve; });
      const results = await Promise.all([
        invoke(sales.createSaleDocument, saleBody(row.id)),
        invoke(sales.createSaleDocument, saleBody(row.id)),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
      assert.equal(await stock(row.id), 0);
      assert.equal(await db.sale.count({ where: { productId: row.id } }), 1);
      assert.equal(await db.saleDocumentItem.count({ where: { productId: row.id } }), 1);
      assert.equal(await db.saleDocument.count({ where: { items: { some: { productId: row.id } } } }), 1);
    });

    await t.test('create and full update reject zero/negative quantities without mutation', async () => {
      const row = await product(2);
      for (const quantity of [0, -1]) {
        const result = await invoke(sales.createSaleDocument, saleBody(row.id, quantity));
        assert.equal(result.status, 400);
      }
      assert.equal(await stock(row.id), 2);
      assert.equal(await db.sale.count({ where: { productId: row.id } }), 0);
      const created = await invoke(sales.createSaleDocument, saleBody(row.id));
      assert.equal(created.status, 201);
      const document = await db.saleDocument.findFirstOrThrow({ where: { items: { some: { productId: row.id } } } });
      const before = await db.saleDocumentItem.findMany({ where: { documentId: document.id } });
      for (const quantity of [0, -1]) {
        const result = await invoke(sales.updateFullOrder, saleBody(row.id, quantity), { id: String(document.id) });
        assert.equal(result.status, 400);
      }
      assert.equal(await stock(row.id), 1);
      assert.deepEqual(await db.saleDocumentItem.findMany({ where: { documentId: document.id } }), before);
      assert.equal((await db.saleDocument.findUniqueOrThrow({ where: { id: document.id } })).total, 100);
      assert.equal(await db.sale.count({ where: { productId: row.id } }), 1);
    });

    await t.test('history deletion service rejects deletion and preserves rows', async () => {
      const row = await product();
      assert.equal((await invoke(sales.createSaleDocument, saleBody(row.id))).status, 201);
      await assert.rejects(deleteProductPreservingHistory(db, row.id),
        (error: any) => error.status === 409 && error.code === 'PRODUCT_HAS_HISTORY');
      assert.equal(await stock(row.id), 0);
      assert.equal(await db.sale.count({ where: { productId: row.id } }), 1);
      assert.equal(await db.saleDocumentItem.count({ where: { productId: row.id } }), 1);
    });

    await t.test('each historical FK independently restricts a direct product delete', async () => {
      for (const keep of ['sale', 'item'] as const) {
        const row = await product();
        assert.equal((await invoke(sales.createSaleDocument, saleBody(row.id))).status, 201);
        // Only remove this test's alternate child to prove each FK on its own.
        if (keep === 'sale') await db.saleDocumentItem.deleteMany({ where: { productId: row.id } });
        else await db.sale.deleteMany({ where: { productId: row.id } });
        await assert.rejects(db.product.delete({ where: { id: row.id } }), (error: any) => error.code === 'P2003');
        assert.equal(await stock(row.id), 0);
        const count = keep === 'sale'
          ? await db.sale.count({ where: { productId: row.id } })
          : await db.saleDocumentItem.count({ where: { productId: row.id } });
        assert.equal(count, 1);
      }
    });

    await t.test('website reservation competes with an instore sale for the final unit', async () => {
      const row = await product();
      const externalOrderId = `sale-stock:${randomUUID()}`;
      externalOrderIds.push(externalOrderId);
      const results = await Promise.all([
        invoke(sales.createSaleDocument, saleBody(row.id)),
        invoke(reservations.createInventoryReservation, {
          externalOrderId, currency: 'RUB', items: [{ productId: row.id, quantity: 1 }],
        }),
      ]);
      assert.deepEqual(results.map(result => result.status).sort(), [201, 409]);
      assert.equal(await stock(row.id), 0);
      const sold = await db.sale.count({ where: { productId: row.id } });
      const reserved = await db.inventoryReservation.count({ where: { externalOrderId, status: 'active' } });
      assert.equal(sold + reserved, 1);
    });
  } finally {
    for (const timer of timers) clearInterval(timer);
    try {
      if (externalOrderIds.length) await db.inventoryReservation.deleteMany({ where: { externalOrderId: { in: externalOrderIds } } });
      if (products.length) {
        await db.sale.deleteMany({ where: { productId: { in: products } } });
        await db.saleDocumentItem.deleteMany({ where: { productId: { in: products } } });
      }
      if (user) {
        await db.saleDocument.deleteMany({ where: { createdBy: user.id } });
        await db.user.delete({ where: { id: user.id } });
      }
      if (products.length) await db.product.deleteMany({ where: { id: { in: products } } });
    } finally {
      await db.$disconnect();
    }
  }
});
