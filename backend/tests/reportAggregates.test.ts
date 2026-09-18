import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { paidOrderTotalsQuery } from '../src/services/reportAggregates.service';

// Controller regression fixtures only: SQL shape is checked, but no PostgreSQL is run.
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
const paid = () => orders.filter(o => o.paymentStatus === 'paid' && o.documentType === 'order');
const db: any = {
  $queryRaw: async (query: any, ...values: any[]) => {
    captured = { query, values };
    if (Array.isArray(query)) {
      const sql = query.join('?');
      if (!sql.includes('WITH grouped AS')) return [];
      assert.match(sql, /LEFT JOIN grouped g ON g\."productId" = p.id/);
      assert.match(sql, /SUM\(i.cost_price\) AS cost/);
      assert.match(sql, /ORDER BY total_profit DESC, id ASC LIMIT \? OFFSET \?/);
      assert.match(sql, /COUNT\(\*\)::double precision FROM calculated/);
      const rows = products.map(p => {
        const items = paid().flatMap(o => o.items).filter(i => i.productId === p.id);
        const sold = items.reduce((s, i) => s + i.quantity, 0);
        const revenue = items.reduce((s, i) => s + i.total, 0);
        const cost = items.reduce((s, i) => s + i.cost_price, 0) || p.cost_price * sold;
        return { id: p.id, total_sold: sold, total_revenue: revenue, total_cost: cost, total_profit: revenue - cost };
      }).sort((a, b) => b.total_profit - a.total_profit || a.id - b.id);
      return [{ rows: rows.slice(values[1], values[1] + values[0]), total: rows.length }];
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
  saleDocumentItem: { groupBy: async (args: any) => {
    assert.deepEqual(args.where, { document: { paymentStatus: 'paid', documentType: 'order' } });
    const groups = new Map<number, any>();
    for (const o of paid()) for (const i of o.items) {
      const g = groups.get(i.productId) || { productId: i.productId, _sum: { quantity: 0, total: 0, cost_price: 0 } };
      for (const k of ['quantity', 'total', 'cost_price']) g._sum[k] += i[k];
      groups.set(i.productId, g);
    }
    return [...groups.values()].sort((a, b) => b._sum.total - a._sum.total).slice(0, args.take);
  } }
};
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

test('summary retains historical quantity-weighted totals and legacy top-product cost fallback', async () => {
  orders = fixture();
  const result = await call('getSummary');
  assert.deepEqual(result.total, { revenue: 100, cost: 10, profit: 90, margin: 90 });
  assert.equal(result.top_products[0].total_cost, 6); // Legacy SUM(unit cost), not SUM(cost * quantity).
  assert.equal(result.top_products[1].total_cost, 10); // Zero sum falls back to current cost * quantity.
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
test('product report keeps legacy financial totals and profit ordering', async () => {
  orders = fixture();
  const result = await call('getProfitByProduct');
  assert.deepEqual(result.map((r: any) => [r.id, r.total_sold, r.total_revenue, r.total_cost, r.total_profit]), [[1, 4, 80, 6, 74], [2, 2, 20, 10, 10]]);
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
  assert.deepEqual(captured.values, [1, 1]);
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
  assert.deepEqual(query.values, [date]);
  assert.ok(!paidOrderTotalsQuery().text.includes('JOIN "Product"'));
});
for (const [input, expected] of [[undefined, 12], ['-1', 12], ['0', 12], ['abc', 12], ['1.5', 12], ['1000000000', 120]] as const) {
  test(`chart normalizes limit ${input} and bounds occupied groups before item join`, async () => {
    await call('getProfitChart', { limit: input, period: 'invalid' });
    const sql = captured.query.join('?');
    assert.match(sql, /WITH RECURSIVE periods/);
    assert.match(sql, /"saleDate" < p.period/);
    assert.match(sql, /JOIN periods/);
    assert.match(sql, /SUM\(sd.total\)/); // Preserve prior join-based revenue semantics.
    assert.ok(captured.values.includes(expected));
    assert.ok(captured.values.includes('month'));
    assert.ok(!captured.values.includes('invalid'));
  });
}

test('chart latest occupied periods preserve old join arithmetic across gaps, ties and empty items', async () => {
  // Independent reference for the OLD all-history LEFT JOIN then GROUP BY path.
  // The mock below models the new period-selection path; neither executes PostgreSQL.
  const rows = fixture();
  rows[0].saleDate = new Date('2025-06-02T00:00:00Z');
  rows[1].saleDate = new Date('2025-06-02T00:00:00Z');
  rows.push({ ...rows[0], id: 10, saleDate: new Date('2025-02-03T00:00:00Z') });
  rows.push({ ...rows[0], id: 11, saleDate: new Date('2024-10-01T00:00:00Z') });
  rows.push({ ...rows[0], id: 12, total: 7, items: [], saleDate: new Date('2025-04-01T00:00:00Z') });
  const eligible = rows.filter(r => r.paymentStatus === 'paid' && r.documentType === 'order');
  const key = (r: any) => r.saleDate.toISOString().slice(0, 7);
  const oldGroups = new Map<string, any>();
  for (const row of eligible) {
    const group = oldGroups.get(key(row)) || { period: key(row), revenue: 0, cost: null, profit: null, sales_count: 0 };
    group.sales_count++;
    for (const item of row.items.length ? row.items : [null]) {
      group.revenue += row.total; // Intentionally repeated once per joined item.
      if (item) {
        group.cost = (group.cost || 0) + item.cost_price * item.quantity;
        group.profit = (group.profit || 0) + row.total - item.cost_price * item.quantity;
      }
    }
    oldGroups.set(key(row), group);
  }
  const expected = [...oldGroups.values()].sort((a, b) => b.period.localeCompare(a.period)).slice(0, 3);
  const original = db.$queryRaw;
  db.$queryRaw = async (strings: TemplateStringsArray, ...values: any[]) => {
    const sql = strings.join('?');
    assert.match(sql, /DATE_TRUNC\(\?, MAX\("saleDate"\)\)/);
    assert.match(sql, /WHERE p.n < \?/);
    assert.match(sql, /JOIN periods p ON p.period = DATE_TRUNC/);
    assert.match(sql, /LEFT JOIN "SaleDocumentItem"/);
    assert.match(sql, /SUM\(sd.total - \(sdi\."cost_price" \* sdi.quantity\)\)/);
    assert.match(sql, /COUNT\(DISTINCT sd.id\)/);
    assert.match(sql, /GROUP BY 1/);
    const limit = values.find(v => typeof v === 'number');
    assert.equal(limit, 3);
    const periods = [...new Set(eligible.map(key))].sort().reverse().slice(0, limit);
    return periods.map(period => {
      const documents = eligible.filter(r => key(r) === period);
      const items = documents.flatMap(r => r.items.map((i: any) => ({ revenue: r.total, cost: i.cost_price * i.quantity })));
      return {
        period,
        revenue: documents.reduce((sum, r) => sum + r.total * Math.max(1, r.items.length), 0),
        cost: items.length ? items.reduce((sum, i) => sum + i.cost, 0) : null,
        profit: items.length ? items.reduce((sum, i) => sum + i.revenue - i.cost, 0) : null,
        sales_count: documents.length
      };
    });
  };
  try {
    const result = await call('getProfitChart', { period: 'month', limit: '3' });
    assert.deepEqual(result, expected);
    assert.deepEqual(result.map((r: any) => r.period), ['2025-06', '2025-04', '2025-02']);
    assert.equal(result[0].revenue, 180); // NOT 100: preserve existing joined revenue.
    assert.equal(result[1].cost, null);
  } finally { db.$queryRaw = original; }
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
