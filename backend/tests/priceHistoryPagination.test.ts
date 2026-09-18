import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

// Real controller, in-memory Prisma boundary; never connects to a database.
const Module = require('node:module');
const originalLoad = Module._load;
const rows = Array.from({ length: 105 }, (_, index) => ({
  id: index + 1, productId: 7, changedAt: new Date('2026-01-01T00:00:00Z'),
  changedBy: index % 3 + 1, oldPrice: 100, newPrice: 110, changeType: 'increase', reason: null,
}));
let query: any;
let countQuery: any;
let userQuery: any;
const db = {
  priceHistory: {
    findMany: async (args: any) => {
      query = args;
      assert.deepEqual(args.orderBy, [{ changedAt: 'desc' }, { id: 'desc' }]);
      return rows.filter(row => row.productId === args.where.productId)
        .sort((a, b) => b.changedAt.getTime() - a.changedAt.getTime() || b.id - a.id)
        .slice(args.skip, args.skip + args.take);
    },
    count: async (args: any) => { countQuery = args; return rows.filter(row => row.productId === args.where.productId).length; },
  },
  user: { findMany: async (args: any) => { userQuery = args; return args.where.id.in.map((id: number) => ({ id, name: `User ${id}` })); } },
};
Module._load = function (id: string, ...args: any[]) {
  if (id === '@prisma/client') return { Prisma, PrismaClient: function () { return db; } };
  return originalLoad.call(this, id, ...args);
};
let getPriceHistory: Function;
try { ({ getPriceHistory } = require('../src/controllers/products.controller')); }
finally { Module._load = originalLoad; }

async function invoke(params: any = {}, id = '7') {
  const response = {
    statusCode: 200, body: undefined as any, headers: {} as Record<string, string>,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
  };
  await getPriceHistory({ query: params, params: { id } }, response);
  return response;
}

for (const [label, limit, take] of [
  ['default', undefined, 50], ['negative', '-1', 50], ['zero', '0', 50],
  ['non-number', 'abc', 50], ['fraction', '1.5', 50], ['maximum', '100', 100],
  ['huge', '1000000000', 100],
] as const) test(`price history ${label} limit is bounded and count covers full product`, async () => {
  const response = await invoke({ limit });
  assert.equal(response.statusCode, 200);
  assert.equal(query.take, take);
  assert.equal(query.skip, 0);
  assert.equal(response.body.length, take);
  assert.equal(response.headers['X-Total-Count'], '105');
  assert.deepEqual(countQuery, { where: { productId: 7 } });
  assert.ok(userQuery.where.id.in.length <= 3);
});

for (const page of ['-1', '0', 'abc', '1.5', '100000000000000000000000']) {
  test(`price history invalid page ${page} defaults safely`, async () => {
    await invoke({ page, limit: '10' });
    assert.equal(query.skip, 0);
    assert.equal(query.take, 10);
  });
}

test('price history equal timestamps have deterministic disjoint pages and page-scoped users', async () => {
  const first = await invoke({ page: '1', limit: '10' });
  const second = await invoke({ page: '2', limit: '10' });
  assert.equal(query.skip, 10);
  assert.deepEqual(first.body.map((row: any) => row.id), [105, 104, 103, 102, 101, 100, 99, 98, 97, 96]);
  assert.deepEqual(second.body.map((row: any) => row.id), [95, 94, 93, 92, 91, 90, 89, 88, 87, 86]);
  assert.deepEqual(new Set(userQuery.where.id.in), new Set(second.body.map((row: any) => row.changedBy.id)));
});

test('price history empty page retains full filtered count', async () => {
  const response = await invoke({ page: '20', limit: '10' });
  assert.deepEqual(response.body, []);
  assert.equal(response.headers['X-Total-Count'], '105');
  assert.deepEqual(userQuery.where.id.in, []);
});

test('price history another product returns only its count and data', async () => {
  const response = await invoke({}, '8');
  assert.deepEqual(response.body, []);
  assert.equal(response.headers['X-Total-Count'], '0');
  assert.deepEqual(countQuery, { where: { productId: 8 } });
});
