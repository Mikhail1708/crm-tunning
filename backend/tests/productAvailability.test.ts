import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import { AddressInfo } from 'node:net';
import { productAvailability } from '../src/domain/productAvailability';

test('free stock includes reservation deductions exactly once', () => {
  assert.equal(productAvailability(3).availabilityStatus, 'in_stock');
  assert.equal(productAvailability(0).availabilityStatus, 'on_order');
  assert.equal(productAvailability(-1).availableStock, 0);
});

test('public HTTP catalogue keeps Дроп Панара 4 дюйма through free-stock 0 → 10 → 0, search, category and pagination', async () => {
  // Isolated controller dependency, no database connection or writes.
  const Module = require('node:module');
  const originalLoad = Module._load;
  const queries: any[] = [];
  const target = { id: 134, name: 'Дроп Панара 4 дюйма', article: 'PANARA-4', description: '', stock: 0, retail_price: 100,
    categories: [{ category: { id: 2, name: 'Подвеска' } }, { category: { id: 3, name: 'Лифт-комплекты' } }], images: [], characteristics: [] };
  const products = [{ ...target, id: 1, name: 'Другой товар', article: 'OTHER', stock: 5, categories: [{ category: { id: 1, name: 'Прочее' } }] }, target];
  const matching = (where: any) => products.filter(product => {
    if (where.stock?.gt !== undefined && !(product.stock > where.stock.gt)) return false;
    if (where.OR && !where.OR.some((filter: any) => Object.entries(filter).some(([key, query]: [string, any]) =>
      String((product as any)[key] || '').toLowerCase().includes(query.contains.toLowerCase())))) return false;
    const category = where.categories?.some;
    if (category && !product.categories.some(link => category.categoryId !== undefined
      ? link.category.id === category.categoryId
      : link.category.name.toLowerCase() === category.category.name.equals.toLowerCase())) return false;
    return true;
  });
  const db = {
    product: {
      findMany: async (query: any) => { queries.push(query); return matching(query.where).slice(query.skip, query.skip + query.take); },
      count: async (query: any) => { assert.deepEqual(query.where, queries[queries.length - 1].where); return matching(query.where).length; },
      findUnique: async (query: any) => products.find(product => product.id === query.where.id) || null,
    },
    category: { findMany: async (query: any) => { assert.equal(query.where.isActive, true); assert.equal(query.select._count.select.products, true); return []; } },
  };
  Module._load = function (id: string, ...args: any[]) {
    return id === '@prisma/client' ? { PrismaClient: function () { return db; } } : originalLoad.call(this, id, ...args);
  };
  let router: any;
  try { router = require('../src/routes/public.routes').default; } finally { Module._load = originalLoad; }
  const app = express();
  app.use('/api/public', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const get = async (url: string) => {
    const response = await fetch(`${origin}/api/public${url}`);
    assert.equal(response.status, 200);
    if (url.startsWith('/products')) assert.equal(response.headers.get('cache-control'), 'no-store');
    return await response.json() as any;
  };
  try {
    for (const stock of [0, 10, 0]) {
      target.stock = stock; // Only this in-memory fixture changes; no working database involved.
      const state = stock > 0 ? 'in_stock' : 'on_order';
      const list = await get('/products?limit=1&page=2');
      assert.equal(list.total, 2);
      assert.equal(list.totalPages, 2);
      assert.equal(list.items[0].name, target.name);
      assert.equal(list.items[0].availabilityStatus, state);
      assert.equal(list.items[0].availableStock, stock);
      const detail = await get('/products/134');
      assert.equal(detail.availabilityStatus, state);
      assert.equal(detail.availableStock, stock);
      for (const query of ['search=Дроп Панара 4 дюйма', 'category=3', 'category=Лифт-комплекты', 'search=PANARA-4&category=Подвеска']) {
        const result = await get(`/products?${encodeURI(query)}`);
        assert.equal(result.total, 1);
        assert.equal(result.items[0].id, 134);
        assert.equal(result.items[0].availabilityStatus, state);
      }
      const absent = await get('/products?category=unknown');
      assert.equal(absent.total, 0);
    }
    assert.equal(queries[0].where.stock, undefined);
    assert.equal(queries[0].include.images.select.data, undefined);
    await get('/categories');
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
  }
});
