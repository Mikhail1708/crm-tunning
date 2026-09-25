import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { clientFinancialTotals, clientsRankedBySpending, withClientFinancialTotals } from '../src/services/clientFinancials.service';

const orders = [
  { clientId: 1, paymentStatus: 'paid', orderStatus: 'confirmed', total: 10 },
  { clientId: 1, paymentStatus: 'paid', orderStatus: 'assembling', total: 20 },
  { clientId: 1, paymentStatus: 'paid', orderStatus: 'shipped', total: 30 },
  { clientId: 1, paymentStatus: 'paid', orderStatus: 'cancelled', total: 40 },
  { clientId: 1, paymentStatus: 'unpaid', orderStatus: 'confirmed', total: 50 },
  { clientId: 1, paymentStatus: 'unpaid', orderStatus: 'shipped', total: 60 },
  { clientId: 2, paymentStatus: 'paid', orderStatus: 'shipped', total: 70 },
];
let aggregateArgs: any;
let sql: Prisma.Sql;
const db: any = {
  saleDocument: {
    groupBy: async (args: any) => {
      aggregateArgs = args;
      assert.deepEqual(args.by, ['clientId']);
      assert.equal(args.where.paymentStatus, 'paid');
      assert.deepEqual(args.where.orderStatus, { not: 'cancelled' });
      const totals = new Map<number, number>();
      for (const row of orders) {
        if (args.where.clientId.in.includes(row.clientId) && row.paymentStatus === args.where.paymentStatus && row.orderStatus !== args.where.orderStatus.not) {
          totals.set(row.clientId, (totals.get(row.clientId) ?? 0) + row.total);
        }
      }
      return [...totals].map(([clientId, total]) => ({ clientId, _sum: { total } }));
    },
    aggregate: async (args: any) => { aggregateArgs = args; return { _sum: { total: 130 } }; },
  },
  client: {
    findMany: async () => [{ id: 1, totalSpent: 999, totalOrders: 6 }, { id: 2, totalSpent: 999, totalOrders: 1 }],
    count: async () => 2,
    findUnique: async () => ({ id: 1, totalSpent: 999, totalOrders: 6 }),
  },
  $queryRaw: async (query: Prisma.Sql) => { sql = query; return [{ id: 2, totalSpent: 70 }, { id: 1, totalSpent: 60 }]; },
};
const Module = require('node:module');
const load = Module._load;
let clients: any, analytics: any;
try {
  Module._load = function(name: string, ...args: any[]) {
    if (name === '@prisma/client') return { Prisma, PrismaClient: function() { return db; } };
    if (name.endsWith('/audit.service')) return { default: {} };
    return load.call(this, name, ...args);
  };
  clients = require('../src/controllers/clients.controller');
  analytics = require('../src/controllers/reportAnalytics.controller');
} finally { Module._load = load; }
async function call(handler: Function, query = {}, params = {}) {
  let body: any;
  const res = { json: (value: any) => { body = value; }, status: (status: number) => { assert.fail(`Unexpected HTTP ${status}`); } };
  await handler({ query, params }, res);
  return body;
}

test('client live totals replace cached money using paid noncancelled orders only', async () => {
  const rows = await withClientFinancialTotals(db, [{ id: 1, totalSpent: 999 }, { id: 3, totalSpent: 999 }]);
  assert.deepEqual(rows, [{ id: 1, totalSpent: 60 }, { id: 3, totalSpent: 0 }]);
  assert.deepEqual(aggregateArgs.where.clientId, { in: [1, 3] });
  assert.deepEqual(await clientFinancialTotals(db, []), new Map());
});
test('restoring paid cancelled order restores its contribution without touching payment', async () => {
  const before = orders.map(row => row.paymentStatus);
  orders[3].orderStatus = 'confirmed';
  try {
    assert.equal((await clientFinancialTotals(db, [1])).get(1), 100);
    assert.deepEqual(orders.map(row => row.paymentStatus), before);
  } finally { orders[3].orderStatus = 'cancelled'; }
});
test('client list and details return current spending and retain full order counts', async () => {
  const list = await call(clients.getAllClients);
  assert.equal(list.clients[0].totalSpent, 60);
  assert.equal(list.clients[0].totalOrders, 6);
  assert.equal(list.total, 2);
  const detail = await call(clients.getClientById, {}, { id: '1' });
  assert.equal(detail.totalSpent, 60);
  assert.equal(detail.totalOrders, 6);
});
test('ranking aggregates full filtered spending in SQL then pages with stable order', async () => {
  await clientsRankedBySpending(db, { search: "x' OR true --", direction: 'asc', limit: 20, skip: 40 });
  assert.match(sql.text, /LEFT JOIN "SaleDocument"/);
  assert.match(sql.text, /"paymentStatus" = \$\d+ AND d\."orderStatus" <> \$\d+/);
  assert.match(sql.text, /GROUP BY c.id[\s\S]*ORDER BY "totalSpent" ASC, c.id ASC LIMIT \$\d+ OFFSET \$\d+/);
  assert.ok(!sql.text.includes("x'"));
  assert.ok(sql.values.includes('paid') && sql.values.includes('cancelled'));
  assert.deepEqual(sql.values.slice(-2), [20, 40]);
});
test('summary and top clients read live paid/noncancelled amounts, not cached totals', async () => {
  const result = await call(clients.getClientsStats);
  assert.equal(result.totalSpent, 130);
  assert.equal(result.topClients[0].id, 2);
  assert.equal(result.topClients[0].totalSpent, 70);
  assert.deepEqual(aggregateArgs.where, { paymentStatus: 'paid', orderStatus: { not: 'cancelled' }, clientId: { not: null } });
});
test('analytics tabs share paid/noncancelled full-filter CTE and date restrictions', () => {
  const query: Prisma.Sql = analytics.analyticsDocuments({ startDate: '2026-01-01', endDate: '2026-02-01', clientId: '1' });
  assert.match(query.text, /WHERE d\."paymentStatus" = \$\d+ AND d\."orderStatus" <> \$\d+/);
  assert.ok(query.values.includes('paid') && query.values.includes('cancelled'));
  assert.match(query.text, /"saleDate" >= \$\d+/);
  assert.match(query.text, /"saleDate" <= \$\d+/);
});
