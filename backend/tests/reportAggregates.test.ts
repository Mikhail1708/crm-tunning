import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { paidOrderTotalsQuery } from '../src/services/reportAggregates.service';

// Execute production financial SELECTs in SQLite memory (Node >=22.13).
// Only PostgreSQL period discovery, JSON packaging and casts are adapted.
const { DatabaseSync } = require('node:sqlite');
const products = [
  { id: 1, name: 'A', article: 'A', cost_price: 9, retail_price: 20, stock: 2, min_stock: 1, categories: [] },
  { id: 2, name: 'B', article: 'B', cost_price: 5, retail_price: 10, stock: 0, min_stock: 1, categories: [] }
];
const date = new Date(new Date().getFullYear(), 0, 2);
let orders: any[] = [];
const fixture = () => [
  { id: 1, saleDate: date, paymentStatus: 'paid', documentType: 'order', total: 80, items: [{ productId: 1, quantity: 3, total: 60, cost_price: 2 }, { productId: 2, quantity: 2, total: 20, cost_price: 0 }] },
  { id: 2, saleDate: date, paymentStatus: 'paid', documentType: 'order', total: 20, items: [{ productId: 1, quantity: 1, total: 20, cost_price: 4 }] },
  { id: 3, saleDate: date, paymentStatus: 'unpaid', documentType: 'order', total: 999, items: [] },
  { id: 4, saleDate: date, paymentStatus: 'paid', documentType: 'invoice', total: 999, items: [] }
];
let captured: any;
const paid = () => orders.filter(o => o.paymentStatus === 'paid' && o.orderStatus !== 'cancelled' && o.documentType === 'order');
const db: any = {
  $queryRaw: async (query: any, ...values: any[]) => {
    const tagged = Array.isArray(query);
    query = tagged ? Prisma.sql(query, ...values) : query;
    values = query.values;
    captured = { query, values };
    assert.match(query.sql, /"orderStatus" <> \?/);
    assert.ok(values.includes('paid') && values.includes('cancelled'));
    if (tagged) {
      return executeReportSql(query);
    }
    assert.match(query.text, /COUNT\(\*\)::double precision/);
    const start = query.values.find((v: any) => v instanceof Date);
    const matching = paid().filter(o => !start || o.saleDate >= start);
    const current = query.text.includes('p.cost_price');
    return [{ count: matching.length, revenue: matching.reduce((s, o) => s + o.total, 0),
      cost: matching.reduce((s, o) => s + o.items.reduce((n: number, i: any) => n + i.quantity * (current ? products.find(p => p.id === i.productId)!.cost_price : i.cost_price), 0), 0) }];
  },
  saleDocument: { findMany: () => { throw new Error('History materialization is forbidden'); } },
  product: { fields: { min_stock: 'min_stock' }, count: async (args: any) => args ? 1 : 2,
    findMany: async () => products, findUnique: async ({ where }: any) => {
      const p = products.find(p => p.id === where.id)!;
      return { id: p.id, name: p.name, article: p.article, retail_price: p.retail_price, cost_price: p.cost_price };
    } },
  client: { count: async () => 4 },

};
function executeReportSql(query: Prisma.Sql): any[] {
  const sqlite = new DatabaseSync(':memory:');
  try {
    sqlite.exec(`
      CREATE TABLE SaleDocument(id INTEGER PRIMARY KEY, saleDate TEXT, paymentStatus TEXT, orderStatus TEXT, documentType TEXT, total REAL);
      CREATE TABLE SaleDocumentItem(documentId INTEGER, productId INTEGER, quantity REAL, total REAL, cost_price REAL);
      CREATE TABLE Product(id INTEGER PRIMARY KEY, name TEXT, article TEXT, cost_price REAL, retail_price REAL, stock REAL, min_stock REAL);
      CREATE TABLE ProductCategory(productId INTEGER, categoryId INTEGER);
      CREATE TABLE Category(id INTEGER PRIMARY KEY, name TEXT);
    `);
    sqlite.function('DATE_TRUNC', (period: string, value: string) => {
      assert.equal(period, 'month');
      return value.slice(0, 7);
    });
    for (const o of orders) {
      sqlite.prepare('INSERT INTO SaleDocument VALUES(?,?,?,?,?,?)').run(o.id, o.saleDate.toISOString(), o.paymentStatus, o.orderStatus || 'confirmed', o.documentType, o.total);
      for (const i of o.items) sqlite.prepare('INSERT INTO SaleDocumentItem VALUES(?,?,?,?,?)').run(o.id, i.productId, i.quantity, i.total, i.cost_price);
    }
    for (const p of products) sqlite.prepare('INSERT INTO Product VALUES(?,?,?,?,?,?,?)').run(p.id, p.name, p.article, p.cost_price, p.retail_price, p.stock, p.min_stock);
    let sql = query.sql;
    let values = [...query.values];
    const chart = sql.includes('WITH RECURSIVE periods');
    const productReport = sql.includes('WITH grouped AS');
    if (chart) {
      assert.match(sql, /WHERE p.n < \?/);
      assert.match(sql, /DATE_TRUNC\(\?, MAX\("saleDate"\)\)/);
      assert.match(sql, /JOIN periods p ON p.period = DATE_TRUNC/);
      assert.match(sql, /GROUP BY 1/);
      assert.match(sql, /GROUP BY i."documentId"/);
      assert.match(sql, /LEFT JOIN item_costs ic ON ic."documentId" = sd.id/);
      assert.doesNotMatch(sql, /SUM\(DISTINCT/i);
      const cutoff = sql.indexOf('selected_documents AS');
      assert.ok(cutoff > 0);
      const parameterCount = (sql.slice(0, cutoff).match(/\?/g) || []).length;
      const limit = values.find(v => typeof v === 'number') as number;
      // Only PostgreSQL LATERAL occupied-period discovery is replaced.
      const periods = [...new Set(paid().map(o => o.saleDate.toISOString().slice(0, 7)))].sort().reverse().slice(0, limit);
      const periodSql = periods.length ? 'VALUES ' + periods.map(() => '(?)').join(',') : 'SELECT NULL WHERE 0';
      sql = 'WITH periods(period) AS (' + periodSql + '), ' + sql.slice(cutoff);
      values = [...periods, ...values.slice(parameterCount)];
    } else if (productReport) {
      assert.match(sql, /LEFT JOIN grouped g ON g\."productId" = p.id/);
      assert.match(sql, /ORDER BY total_profit DESC, id ASC LIMIT \? OFFSET \?/);
      assert.match(sql, /SUM\(i.cost_price \* i.quantity\) AS cost/);
      assert.match(sql, /COUNT\(\*\)::double precision FROM calculated/);
      // Execute calculated rows/order/page; replace PostgreSQL json_agg packaging only.
      const cutoff = sql.indexOf('), page_rows AS');
      assert.ok(cutoff > 0);
      sql = sql.slice(0, cutoff) + ') SELECT * FROM calculated ORDER BY total_profit DESC, id ASC LIMIT ? OFFSET ?';
    } else {
      assert.match(sql, /SUM\(i.cost_price \* i.quantity\) AS cost/);
      assert.match(sql, /GROUP BY i."productId" ORDER BY revenue DESC, i."productId" ASC LIMIT 5/);
    }
    sql = sql.replace(/::double precision/g, '');
    const rows = sqlite.prepare(sql).all(...values).map((row: any) => ({ ...row }));
    return productReport ? [{ rows, total: products.length }] : rows;
  } finally { sqlite.close(); }
}
const Module = require('node:module');
const load = Module._load;
let controller: any;
try {
  Module._load = function(id: string, ...args: any[]) {
    return id === '@prisma/client' ? { Prisma, PrismaClient: function() { return db; } } : load.call(this, id, ...args);
  };
  controller = require('../src/controllers/reports.controller');
} finally { Module._load = load; }
async function call(name: string, query: any = {}, params: any = {}) {
  let result: any;
  await controller[name]({ query, params }, { setHeader: () => {}, json: (v: any) => { result = v; }, status: (code: number) => { throw new Error(`Unexpected HTTP ${code}`); } });
  return result;
}

test('summary uses quantity-weighted historical costs including legitimate zero cost', async () => {
  orders = fixture();
  const result = await call('getSummary');
  assert.deepEqual(result.total, { revenue: 100, cost: 10, profit: 90, margin: 90 });
  assert.equal(result.top_products[0].total_cost, 10);
  assert.equal(result.top_products[1].total_cost, 0);
});
test('period stats retain current product cost, excluding unpaid/non-order documents', async () => {
  orders = fixture();
  const result = await call('getSalesStats', {}, { period: 'year' });
  assert.equal(result.totalOrders, 2);
  assert.equal(result.totalRevenue, 100);
  assert.equal(result.totalProfit, 54);
  assert.equal(result.averageCheck, 50);
});
test('empty summary and empty period retain zero totals', async () => {
  orders = [];
  assert.deepEqual((await call('getSummary')).total, { revenue: 0, cost: 0, profit: 0, margin: 0 });
  assert.equal((await call('getSalesStats', {}, { period: 'year' })).totalProfit, 0);
});
test('stats date boundary matches prior reducer on the same fixture, including empty periods', async () => {
  orders = fixture();
  orders.push({ ...orders[0], id: 5, saleDate: new Date(date.getFullYear() - 1, 11, 31) });
  const result = await call('getSalesStats', {}, { period: 'year' });
  const matching = paid().filter(o => o.saleDate >= result.startDate);
  const oldRevenue = matching.reduce((sum, o) => sum + o.total, 0);
  const oldProfit = matching.reduce((sum, o) => sum + o.total - o.items.reduce((n: number, i: any) =>
    n + products.find(p => p.id === i.productId)!.cost_price * i.quantity, 0), 0);
  assert.equal(result.totalRevenue, oldRevenue);
  assert.equal(result.totalProfit, oldProfit);
  orders = [orders[orders.length - 1]];
  assert.equal((await call('getSalesStats', {}, { period: 'year' })).totalOrders, 0);
});
test('orders retains full totals while removing unused sales/client includes', async () => {
  orders = fixture();
  const original = db.saleDocument.findMany;
  db.saleDocument.findMany = async (query: any) => {
    assert.deepEqual(query.include, { items: true });
    return paid();
  };
  try {
    const result = await call('getOrdersByPeriod');
    assert.equal(result.stats.totalRevenue, 100);
    assert.equal(result.stats.totalProfit, 90);
    assert.equal(result.orders.length, 2);
  } finally { db.saleDocument.findMany = original; }
});
test('product report uses weighted financial totals and profit ordering', async () => {
  orders = fixture();
  const result = await call('getProfitByProduct');
  assert.deepEqual(result.map((r: any) => [r.id, r.total_sold, r.total_revenue, r.total_cost, r.total_profit]), [[1, 4, 80, 10, 70], [2, 2, 20, 0, 20]]);
});
test('no paid orders still returns all products with zero financial metrics', async () => {
  orders = [];
  const result = await call('getProfitByProduct');
  assert.equal(result.length, products.length);
  assert.ok(result.every((r: any) => r.total_profit === 0 && r.total_sold === 0 && r.total_cost === 0));
});
test('product report bounds results but preserves full count and zero-sale products', async () => {
  orders = fixture();
  let total = '';
  let result: any;
  await controller.getProfitByProduct({ query: { page: '2', limit: '1' } }, {
    setHeader: (name: string, value: string) => { if (name === 'X-Total-Count') total = value; },
    json: (value: any) => { result = value; }
  });
  assert.equal(total, '2');
  assert.equal(result.length, 1);
  assert.equal(result[0].id, 2);
  assert.deepEqual(captured.values, ['paid', 'cancelled', 1, 1]);
});
test('expenses uses the full date filter for total and category sums, independent of page', async () => {
  const calls: any = {};
  db.expense = {
    findMany: async (args: any) => { calls.rows = args; return [{ id: 9, amount: 5 }]; },
    aggregate: async (args: any) => { calls.totals = args; return { _count: 8, _sum: { amount: 123 } }; },
    groupBy: async (args: any) => { calls.categories = args; return [{ category: 'A', _sum: { amount: 123 } }]; }
  };
  const result = await call('getExpenses', { startDate: '2026-01-01', endDate: '2026-02-01', page: '2', limit: '1' });
  assert.equal(result.total, 8);
  assert.equal(result.summary.total, 123);
  assert.deepEqual(calls.totals.where, calls.rows.where);
  assert.deepEqual(calls.categories.where, calls.rows.where);
  assert.equal(calls.rows.take, 1);
  assert.equal(calls.rows.skip, 1);
  assert.deepEqual(calls.rows.orderBy, [{ expense_date: 'desc' }, { id: 'desc' }]);
});
test('totals SQL keeps revenue independent of item multiplicity and dates parameterized', () => {
  const query = paidOrderTotalsQuery(date, true);
  assert.match(query.text, /SELECT SUM\(total\) FROM orders/);
  assert.match(query.text, /JOIN "Product" p/);
  assert.deepEqual(query.values, ['paid', 'cancelled', date]);
  assert.ok(!paidOrderTotalsQuery().text.includes('JOIN "Product"'));
});
for (const [input, expected] of [[undefined, 12], ['-1', 12], ['0', 12], ['abc', 12], ['1.5', 12], ['1000000000', 120]] as const) {
  test(`chart normalizes limit ${input} and bounds occupied groups before item join`, async () => {
    await call('getProfitChart', { limit: input, period: 'invalid' });
    const sql = captured.query.sql;
    assert.match(sql, /WITH RECURSIVE periods/);
    assert.match(sql, /"saleDate" < p.period/);
    assert.match(sql, /JOIN periods/);
    assert.match(sql, /SUM\(sd.total\)/);
    assert.ok(captured.values.includes(expected));
    assert.ok(captured.values.includes('month'));
    assert.ok(!captured.values.includes('invalid'));
  });
}

test('chart preserves latest occupied periods, gaps and no-item documents', async () => {
  orders = fixture();
  orders[0].saleDate = new Date('2025-06-02T00:00:00Z');
  orders[1].saleDate = new Date('2025-06-02T00:00:00Z');
  orders.push({ ...orders[0], id: 10, saleDate: new Date('2025-02-03T00:00:00Z') });
  orders.push({ ...orders[0], id: 11, saleDate: new Date('2024-10-01T00:00:00Z') });
  orders.push({ ...orders[0], id: 12, total: 7, items: [], saleDate: new Date('2025-04-01T00:00:00Z') });
  assert.deepEqual(await call('getProfitChart', { period: 'month', limit: '3' }), [
    { period: '2025-06', revenue: 100, cost: 10, profit: 90, sales_count: 2 },
    { period: '2025-04', revenue: 7, cost: 0, profit: 7, sales_count: 1 },
    { period: '2025-02', revenue: 80, cost: 6, profit: 74, sales_count: 1 }
  ]);
});

const financialOrder = (total: number, items: any[], overrides: any = {}) => ({
  id: 1, saleDate: date, paymentStatus: 'paid', orderStatus: 'confirmed', documentType: 'order', total, items, ...overrides
});
const line = (quantity = 1, cost_price = 1000, total = 6000) => ({ productId: 1, quantity, cost_price, total });
for (const scenario of [
  { name: 'three items never multiply document revenue', rows: [financialOrder(25000, [line(), line(), line()])], revenue: 25000, cost: 3000, profit: 22000, count: 1 },
  { name: 'quantity weights unit cost exactly once', rows: [financialOrder(6000, [line(3)])], revenue: 6000, cost: 3000, profit: 3000, count: 1 },
  { name: 'no items retains full document profit', rows: [financialOrder(10000, [])], revenue: 10000, cost: 0, profit: 10000, count: 1 },
  { name: 'distinct documents with equal totals both count', rows: [financialOrder(25000, [line()]), financialOrder(25000, [line()], { id: 2 })], revenue: 50000, cost: 2000, profit: 48000, count: 2 },
  { name: 'paid cancelled contributes no money', rows: [financialOrder(25000, [line(3)], { orderStatus: 'cancelled' })], revenue: 0, cost: 0, profit: 0, count: 0 }
]) {
  test('SQL arithmetic: ' + scenario.name, async () => {
    orders = scenario.rows;
    const chart = await call('getProfitChart');
    assert.equal(chart.reduce((s: number, r: any) => s + r.revenue, 0), scenario.revenue);
    assert.equal(chart.reduce((s: number, r: any) => s + r.cost, 0), scenario.cost);
    assert.equal(chart.reduce((s: number, r: any) => s + r.profit, 0), scenario.profit);
    assert.equal(chart.reduce((s: number, r: any) => s + r.sales_count, 0), scenario.count);
  });
}
test('SQL product report and summary top products both weight cost and exclude ineligible items', async () => {
  orders = [financialOrder(6000, [line(3)]),
    financialOrder(90000, [line(9)], { id: 2, orderStatus: 'cancelled' }),
    financialOrder(90000, [line(9)], { id: 3, paymentStatus: 'not_paid' })];
  for (const rows of [await call('getProfitByProduct'), (await call('getSummary')).top_products]) {
    const row = rows.find((r: any) => r.id === 1);
    assert.equal(row.total_sold, 3);
    assert.equal(row.total_revenue, 6000);
    assert.equal(row.total_cost, 3000);
    assert.equal(row.total_profit, 3000);
  }
});

test('summary, period stats and chart keep database errors out of HTTP responses', async () => {
  const original = db.$queryRaw;
  const originalLog = console.error;
  db.$queryRaw = async () => { throw new Error('private SQL credential sentinel'); };
  console.error = () => {};
  try {
    for (const name of ['getSummary', 'getSalesStats', 'getProfitChart']) {
      let status = 200;
      let body: any;
      const response: any = { status: (value: number) => { status = value; return response; }, json: (value: any) => { body = value; } };
      await controller[name]({ query: {}, params: { period: 'year' } }, response);
      assert.equal(status, 500);
      assert.ok(!JSON.stringify(body).includes('sentinel'));
      assert.ok(!JSON.stringify(body).includes('stack'));
    }
  } finally { db.$queryRaw = original; console.error = originalLog; }
});

// Eligibility must remain identical across full and bounded monetary reports.
test('full and bounded reports exclude cancelled/unpaid documents and include restored paid orders', async () => {
  const states = [
    ['paid', 'confirmed'], ['paid', 'assembling'], ['paid', 'shipped'],
    ['paid', 'cancelled'], ['unpaid', 'confirmed'], ['unpaid', 'shipped'],
    ['pending', 'confirmed'], ['failed', 'shipped']
  ];
  orders = states.map(([paymentStatus, orderStatus], index) => ({
    id: index + 1, paymentStatus, orderStatus, documentType: 'order', saleDate: date,
    total: 10, items: [{ productId: 1, quantity: 1, total: 10, cost_price: 2 }]
  }));
  const original = db.saleDocument.findMany;
  db.saleDocument.findMany = async (query: any) => {
    assert.deepEqual(query.where, { documentType: 'order', paymentStatus: 'paid', orderStatus: { not: 'cancelled' } });
    assert.equal(query.take, 1);
    return paid().slice(query.skip, query.skip + query.take);
  };
  try {
    const cancelled = orders[3];
    assert.equal((await call('getSummary')).total.revenue, 30);
    assert.equal((await call('getSalesStats', {}, { period: 'year' })).totalRevenue, 30);
    const page = await call('getOrdersByPeriod', { page: '2', limit: '1' });
    assert.equal(page.orders.length, 1);
    assert.equal(page.stats.totalRevenue, 30);
    assert.equal(page.stats.totalOrders, 3);
    const products = await call('getProfitByProduct', { limit: '1' });
    assert.equal(products[0].total_revenue, 30);
    assert.equal(products[0].total_sold, 3);
    assert.equal(cancelled.paymentStatus, 'paid');
    cancelled.orderStatus = 'assembling';
    assert.equal((await call('getSummary')).total.revenue, 40);
    assert.equal((await call('getOrdersByPeriod', { limit: '1' })).stats.totalRevenue, 40);
    assert.equal(cancelled.paymentStatus, 'paid');
  } finally { db.saleDocument.findMany = original; }
});

test('chart filters cancelled documents both when finding occupied periods and when aggregating', async () => {
  await call('getProfitChart', { period: 'month', limit: '2' });
  assert.equal((captured.query.sql.match(/"orderStatus" <> \?/g) || []).length, 3);
  assert.equal(captured.values.filter((v: unknown) => v === 'paid').length, 3);
  assert.equal(captured.values.filter((v: unknown) => v === 'cancelled').length, 3);
});
