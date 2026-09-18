import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { productListFilter, productListOrder } from '../src/services/productList.service';

// Real handlers and SQL builder; fixture-only boundaries, no database access.
const Module = require('node:module');
const originalLoad = Module._load;
const products = Array.from({ length: 205 }, (_, index) => ({
  id: index + 1, name: `Product ${index + 1}`, stock: 2, min_stock: 5,
  cost_price: 3, retail_price: 10, createdAt: new Date('2026-01-01'),
  categories: [], characteristics: [],
}));
let sqlCalls: any[] = [];
let hydrationQuery: any;
let lowQuery: any;
let lowCountQuery: any;
const db = {
  $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
    const sql = Prisma.sql(strings, ...values);
    sqlCalls.push(sql);
    if (sql.text.includes('AS "totalValue"')) return [{ total: 205n, totalStock: 410n, totalValue: 1230, lowStock: 205n }];
    if (sql.text.startsWith('SELECT count(*)')) return [{ total: 205n }];
    assert.match(sql.text, /ORDER BY p\."createdAt" DESC, p\.id DESC LIMIT \$\d+ OFFSET \$\d+/);
    const [limit, skip] = sql.values.slice(-2) as number[];
    return [...products].reverse().slice(skip, skip + limit).map(({ id }) => ({ id }));
  },
  product: {
    fields: { min_stock: 'min_stock_ref' },
    findMany: async (query: any) => {
      if (query.where.id) {
        hydrationQuery = query;
        return products.filter(product => query.where.id.in.includes(product.id));
      }
      lowQuery = query;
      return products.slice(query.skip, query.skip + query.take);
    },
    count: async (query: any) => { lowCountQuery = query; return products.length; },
  },
};
Module._load = function (id: string, ...args: any[]) {
  if (id === '@prisma/client') return { Prisma, PrismaClient: function () { return db; } };
  return originalLoad.call(this, id, ...args);
};
let controllers: any;
try { controllers = require('../src/controllers/products.controller'); } finally { Module._load = originalLoad; }

async function invoke(handler: string, query: any = {}) {
  sqlCalls = [];
  const response = { code: 200, body: undefined as any, headers: {} as Record<string, string>,
    status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader(name: string, value: string) { this.headers[name] = value; },
  };
  await controllers[handler]({ query }, response);
  assert.equal(response.code, 200);
  return response;
}

for (const [value, expected] of [[undefined, 50], ['-1', 50], ['0', 50], ['1.5', 50], ['abc', 50], ['1000000000', 200]] as const) {
  test(`products limit ${value} bounds both ids and relation hydration`, async () => {
    const response = await invoke('getProducts', { limit: value });
    assert.deepEqual(sqlCalls[0].values.slice(-2), [expected, 0]);
    assert.equal(hydrationQuery.take, expected);
    assert.equal(hydrationQuery.where.id.in.length, expected);
    assert.equal(response.body.length, expected);
    assert.equal(response.headers['X-Total-Count'], '205');
  });
}

test('products equal timestamps have deterministic disjoint pages and total not page size', async () => {
  const first = await invoke('getProducts', { page: '1', limit: '10' });
  const second = await invoke('getProducts', { page: '2', limit: '10' });
  assert.deepEqual(first.body.map((p: any) => p.id), [205, 204, 203, 202, 201, 200, 199, 198, 197, 196]);
  assert.deepEqual(second.body.map((p: any) => p.id), [195, 194, 193, 192, 191, 190, 189, 188, 187, 186]);
  assert.equal(second.headers['X-Total-Count'], '205');
});

test('list and count use the same full-filter SQL and bound values', async () => {
  const filters = { search: 'blue', categoryIds: '2,3', priceMin: '5', stockStatus: 'low', characteristics: '{"4":["A","B"]}' };
  await invoke('getProducts', filters);
  const expected = productListFilter(filters);
  assert.deepEqual(sqlCalls[0].values.slice(0, -2), expected.values);
  assert.deepEqual(sqlCalls[1].values, expected.values);
  assert.match(sqlCalls[0].text, /ProductCategory/);
  assert.match(sqlCalls[0].text, /ProductCharacteristic/);
});

test('summary aggregates complete filtered stock and value in PostgreSQL without hydrating products', async () => {
  hydrationQuery = null;
  const filters = { categoryIds: '3', priceMax: '50' };
  const response = await invoke('getProductsSummary', filters);
  assert.deepEqual(response.body, { total: 205, totalStock: 410, totalValue: 1230, lowStock: 205 });
  assert.equal(hydrationQuery, null);
  assert.match(sqlCalls[0].text, /sum\(p.stock::double precision \* p.cost_price\)/);
  assert.match(sqlCalls[0].text, /count\(\*\) FILTER \(WHERE p.stock <= p.min_stock\)/);
  assert.doesNotMatch(sqlCalls[0].text, /LIMIT|OFFSET/);
  assert.deepEqual(sqlCalls[0].values, productListFilter(filters).values);
});

test('low stock has small default and capped pages, stable order, and full-filter total', async () => {
  for (const [limit, expected] of [[undefined, 10], ['-1', 10], ['999999999', 100]] as const) {
    const response = await invoke('getLowStockProducts', { limit, page: '2' });
    assert.equal(lowQuery.take, expected);
    assert.equal(lowQuery.skip, expected);
    assert.deepEqual(lowQuery.orderBy, [{ stock: 'asc' }, { id: 'asc' }]);
    assert.deepEqual(lowCountQuery.where, lowQuery.where);
    assert.equal(response.headers['X-Total-Count'], '205');
  }
});

test('search scopes, prices, category OR, stock and characteristic filters stay parameterized', () => {
  const payload = "'); DROP TABLE Product; --";
  const result = productListFilter({ search: payload, categoryIds: '2,3', priceMin: '1', priceMax: '20',
    stockStatus: 'low', inStockOnly: true, characteristics: { 9: ['red', 'blue'], 10: 'long' } });
  assert.ok(result.values.includes(payload));
  assert.ok(!result.text.includes(payload));
  assert.match(result.text, /p.stock > 0/);
  assert.match(result.text, /COALESCE\(NULLIF\(p.min_stock, 0\), 5\)/);
  assert.match(result.text, /"categoryId" IN \(/);
  assert.match(result.text, /json_array_elements_text/);
  assert.ok(result.values.includes('red') && result.values.includes('blue'));
  assert.ok(!productListFilter({ search: 'x', searchScope: 'basic' }).text.includes('ProductCharacteristic'));
  assert.match(productListFilter({ search: 'x', searchScope: 'description' }).text, /p.description/);
  assert.ok(productListFilter({ characteristics: '{"9":["red","blue"]}', characteristicMode: 'joined' }).values.includes('red, blue'));
});

test('sort identifiers are whitelisted and always end in an id tie-breaker', () => {
  assert.equal(productListOrder({ sortBy: 'name', sortOrder: 'asc' }).text, 'p.name ASC, p.id ASC');
  assert.equal(productListOrder({ sortBy: 'name; DROP', sortOrder: 'desc; DROP' }).text, 'p."createdAt" DESC, p.id DESC');
});

test('JSON characteristic guard rejects malformed escapes before PostgreSQL text extraction', () => {
  const filter = productListFilter({ search: 'x' });
  const guard = filter.values.find(value => typeof value === 'string' && value.startsWith('^[[:space:]]')) as string;
  assert.ok(guard);
  // The guard uses only shared ERE syntax plus POSIX character classes. Adapt
  // those classes for this fixture test; this is not a PostgreSQL integration test.
  const matcher = new RegExp(guard.split('[[:space:]]').join('[\\t\\n\\r ]').split('[:cntrl:]').join('\\x00-\\x1f\\x7f'));
  for (const input of ['[]', '["red","blue"]', '["\\u0410"]', '["\\uD83D\\uDE00"]', '["\\\\u0000"]']) {
    assert.ok(matcher.test(input), `representable JSON accepted: ${input}`);
  }
  for (const input of ['["\\u0000"]', '["\\uD800"]', '["\\uDC00"]', '["\\uD800\\u0041"]', '["\\q"]', '["broken]']) {
    assert.ok(!matcher.test(input), `unsafe JSON stays plain text: ${input}`);
  }
});
