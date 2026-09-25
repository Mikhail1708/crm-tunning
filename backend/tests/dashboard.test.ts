import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

const start = new Date('2026-09-01T00:00:00Z');
const end = new Date('2026-09-30T23:59:59.999Z');
const orders = Array.from({ length: 12 }, (_, index) => ({
  id: index + 1, saleDate: new Date('2026-09-12'), documentNumber: `D-${index}`,
  customerName: 'Fixture', clientName: null, client: { city: 'Test' }, documentType: index ? 'order' : 'receipt',
  orderStatus: index === 0 ? 'cancelled' : 'confirmed', paymentStatus: index < 10 ? (index === 1 ? 'payed' : 'paid') : 'unpaid', total: 100,
  items: [{ cost_price: 10, quantity: 2 }, { cost_price: 5, quantity: 1 }],
}));
let queries: any[] = [];
let fail = false;
const matching = () => orders.filter(order => order.paymentStatus === 'paid' && order.orderStatus !== 'cancelled');
const db: any = {
  $queryRaw: async (query: any) => {
    if (fail) throw new Error('private-db-secret-sentinel');
    const sql = query.text ?? query.join('?'); queries.push(query);
    if (sql.includes('WITH docs')) {
      assert.match(sql, /SUM\(total\) FILTER\(WHERE paid\)/);
      assert.match(sql, /SUM\(i.cost_price \* i.quantity\)/);
      assert.deepEqual(query.values, ['paid', 'cancelled', start, end]);
      assert.match(sql, /d."orderStatus" <>/);
      return [{ totalSales: matching().length, totalRevenue: matching().reduce((sum, row) => sum + row.total, 0),
        totalCost: matching().reduce((sum, row) => sum + row.items.reduce((s, item) => s + item.cost_price * item.quantity, 0), 0),
        unpaidSales: 2, unpaidTotal: 0 }];
    }
    if (sql.includes('WITH top')) {
      assert.match(sql, /LIMIT 5/); assert.match(sql, /LIMIT 1/);
      assert.ok(query.values.every((v: Date) => v instanceof Date || v === ('paid' as any) || v === ('cancelled' as any))); return [];
    }
    assert.match(sql, /SUM\(stock\)/);
    return [{ totalProducts: 500, totalStock: 800, lowStockCount: 60 }];
  },
  product: { fields: { min_stock: 'min_stock' }, findMany: async (q: any) => {
    assert.equal(q.take, 10); assert.deepEqual(q.orderBy, [{ stock: 'asc' }, { id: 'asc' }]);
    assert.deepEqual(q.where, { stock: { lte: 'min_stock' } }); return Array.from({ length: 10 }, (_, id) => ({ id }));
  } },
  saleDocument: { findMany: async (q: any) => {
    assert.equal(q.take, 5); assert.deepEqual(q.orderBy, [{ saleDate: 'desc' }, { id: 'desc' }]);
    assert.deepEqual(q.where.saleDate, { gte: start, lte: end });
    assert.equal(q.where.paymentStatus, 'paid'); assert.deepEqual(q.where.orderStatus, { not: 'cancelled' }); return matching().slice(0, q.take);
  } },
  client: { count: async () => 1200, findMany: async (q: any) => {
    assert.equal(q.take, 5); assert.deepEqual(q.where.createdAt, { gte: start, lte: end }); return [];
  } },
  $transaction: async (fn: Function, options: any) => {
    assert.equal(options.isolationLevel, 'RepeatableRead'); return fn(db);
  },
};
const Module = require('node:module'), load = Module._load;
let handler: any;
try {
  Module._load = function(id: string, ...args: any[]) {
    return id === '@prisma/client' ? { Prisma, PrismaClient: function() { return db; } } : load.call(this, id, ...args);
  };
  handler = require('../src/controllers/dashboard.controller').getDashboard;
} finally { Module._load = load; }
async function invoke(query: any) {
  const res: any = { code: 200, body: undefined, status(code: number) { this.code = code; return this; }, json(body: any) { this.body = body; } };
  await handler({ query }, res); return res;
}
test('dashboard full monthly totals are independent of bounded recent lists', async () => {
  queries = [];
  const result = await invoke({ startDate: start.toISOString(), endDate: end.toISOString() });
  assert.equal(result.code, 200);
  assert.equal(result.body.summary.totalSales, 8);
  assert.equal(result.body.summary.totalRevenue, 800);
  assert.equal(result.body.summary.totalCost, 200);
  assert.equal(result.body.summary.totalProfit, 600);
  assert.equal(result.body.summary.averageCheck, 100);
  assert.equal(result.body.summary.lowStockCount, 60);
  assert.equal(result.body.summary.totalClients, 1200);
  assert.equal(result.body.recentSales.length, 5);
  assert.equal(result.body.recentSales[0].profit, 75);
  assert.equal(result.body.lowStockProducts.length, 10);
  assert.equal(queries.length, 3);
});
test('dashboard rejects invalid, inverted and oversized periods before DB access', async () => {
  queries = [];
  for (const query of [{}, { startDate: 'bad', endDate: end.toISOString() },
    { startDate: end.toISOString(), endDate: start.toISOString() },
    { startDate: '2020-01-01', endDate: '2026-01-01' }]) assert.equal((await invoke(query)).code, 400);
  assert.equal(queries.length, 0);
});
test('dashboard DB failure preserves safe HTTP errors', async () => {
  fail = true;
  try {
    const result = await invoke({ startDate: start.toISOString(), endDate: end.toISOString() });
    assert.equal(result.code, 500); assert.doesNotMatch(JSON.stringify(result.body), /sentinel|stack|secret/);
  } finally { fail = false; }
});


test('restored paid orders rejoin monthly money without changing payment or document amount', async () => {
  const order = orders[0];
  assert.equal(order.paymentStatus, 'paid');
  assert.equal(order.orderStatus, 'cancelled');
  try {
    for (const status of ['confirmed', 'assembling']) {
      order.orderStatus = status;
      const result = await invoke({ startDate: start.toISOString(), endDate: end.toISOString() });
      assert.equal(result.code, 200);
      assert.equal(result.body.summary.totalRevenue, 900);
      assert.equal(result.body.summary.totalSales, 9);
      assert.equal(result.body.summary.averageCheck, 100);
      assert.equal(result.body.recentSales.length, 5);
      assert.equal(order.paymentStatus, 'paid');
      assert.equal(order.total, 100);
    }
  } finally { order.orderStatus = 'cancelled'; }
});
