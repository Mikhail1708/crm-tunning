import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

// Query/HTTP regressions with mocked DB, not a PostgreSQL execution test.
let query: Prisma.Sql;
let failure = false;
const db = { $queryRaw: async (sql: Prisma.Sql) => {
  if (failure) throw new Error('private SQL sentinel');
  query = sql;
  return [{ rows: [{ id: 2 }], total: 75,
    stats: { totalOrders: 3, totalRevenue: 120, totalCost: 35, totalProfit: 85 },
    unpaid: { unpaidCount: 2, unpaidAmount: 900 }, chart: [] }];
} };
const Module = require('node:module');
const original = Module._load;
let controller: any;
try {
  Module._load = function(id: string, ...args: any[]) {
    return id === '@prisma/client' ? { Prisma, PrismaClient: function() { return db; } } : original.call(this, id, ...args);
  };
  controller = require('../src/controllers/reportAnalytics.controller');
} finally { Module._load = original; }
async function call(params: Record<string, unknown>) {
  let body: any, status = 200;
  const res = { json(value: any) { body = value; }, status(code: number) { status = code; return res; } };
  await controller.getReportAnalytics({ query: params }, res);
  return { body, status };
}

for (const tab of ['overview', 'products', 'clients', 'cities', 'cost']) {
  test(`analytics ${tab}: bounded rows, full-filter totals, stable ordering, parameterized filters`, async () => {
    const { body, status } = await call({ tab, page: '2', limit: '20', productId: '3', clientId: '4', city: "a' OR 1=1 --", startDate: '2026-01-01', endDate: '2026-02-01' });
    assert.equal(status, 200);
    assert.equal(body.total, 75);
    assert.equal(body.rows.length, 1);
    assert.equal(body.stats.totalRevenue, 120);
    assert.equal(body.stats.totalProfit, 85);
    assert.equal(body.stats.averageCheck, 40);
    assert.equal(body.stats.unpaidCount, 2);
    assert.match(query.text, /COUNT\(\*\)::double precision FROM grouped/);
    assert.match(query.text, /FROM doc_rows\) AS stats/);
    assert.match(query.text, /LIMIT \$\d+ OFFSET \$\d+/);
    assert.match(query.text, /paymentStatus" = \$\d+ AND d."orderStatus" <> \$\d+/);
    assert.ok(query.values.includes('paid'));
    assert.ok(query.values.includes('cancelled'));
    assert.match(query.text, /EXISTS \(SELECT 1 FROM "SaleDocumentItem"/);
    assert.ok(!query.text.includes("a' OR 1=1"));
    assert.ok(query.values.includes("a' OR 1=1 --"));
    assert.deepEqual(query.values.slice(-2), [20, 20]);
    if (tab === 'overview') {
      assert.match(query.text, /"saleDate" DESC, id DESC/);
      assert.match(query.text, /"documentId" = r.id ORDER BY id LIMIT 200/);
    }
    if (tab === 'products') assert.match(query.text, /SUM\(\(i.price - i.cost_price\) \* i.quantity\)/);
    if (tab === 'cost') assert.match(query.text, /SUM\(i.cost_price \* i.quantity\)/);
  });
}
test('analytics defaults, maximum and unsafe page are normalized', async () => {
  assert.equal((await call({ limit: '-1', page: '1.5' })).body.limit, 50);
  const result = await call({ limit: '1000000000', page: '99999999999999999999' });
  assert.equal(result.body.limit, 200);
  assert.equal(result.body.page, 1);
  assert.deepEqual(query.values.slice(-2), [200, 0]);
});
test('analytics database errors remain safe', async () => {
  failure = true;
  const log = console.error; console.error = () => {};
  try {
    const result = await call({});
    assert.equal(result.status, 500);
    assert.ok(!JSON.stringify(result.body).includes('sentinel'));
  } finally { failure = false; console.error = log; }
});
