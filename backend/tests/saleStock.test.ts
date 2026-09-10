import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import {
  assertPositiveQuantity, assertSaleItems, deductSaleStock, lockSaleDocument,
  replaceSaleStock, SaleStockError, SaleStockItem,
} from '../src/services/saleStock.service';
import { validateSaleItems } from '../src/middleware/saleItems.middleware';

const isStockConflict = (error: unknown): boolean => error instanceof SaleStockError
  && error.status === 409 && error.code === 'INSUFFICIENT_STOCK';

// Transaction/row-lock MODEL only: this verifies the service's contract with a
// store, not PostgreSQL isolation, SQL execution, deadlocks, or real FK behavior.
function memoryStore(initial: Array<[number, number]>) {
  const stock = new Map(initial);
  const documents = new Map<number, SaleStockItem[]>();
  const tails = new Map<string, Promise<void>>();
  const mutations: number[] = [];
  async function transaction<T>(run: (tx: Prisma.TransactionClient, readDocument: (id: number) => Promise<SaleStockItem[]>, writeDocument: (id: number, items: SaleStockItem[]) => void) => Promise<T>) {
    const releases: Array<() => void> = [];
    const held = new Set<string>();
    const before = new Map<number, number>();
    const documentBefore = new Map<number, SaleStockItem[]>();
    const clone = (items: SaleStockItem[]) => items.map(item => ({ ...item }));
    async function lock(key: string) {
      if (held.has(key)) return;
      const previous = tails.get(key) || Promise.resolve();
      let release!: () => void;
      const current = new Promise<void>(resolve => { release = resolve; });
      tails.set(key, current);
      await previous;
      held.add(key);
      releases.push(() => { release(); if (tails.get(key) === current) tails.delete(key); });
    }
    const remember = (id: number) => {
      assert.ok(held.has(`product:${id}`), 'stock mutation must follow product lock');
      if (!before.has(id)) before.set(id, stock.get(id)!);
    };
    const tx = {
      $queryRaw: async (strings: TemplateStringsArray, ...values: any[]) => {
        const sql = strings.join('?');
        if (sql.includes('"SaleDocument"')) {
          assert.match(sql, /FOR UPDATE/);
          await lock(`document:${values[0]}`);
        } else {
          assert.match(sql, /ORDER BY id FOR UPDATE/);
          const ids: number[] = values.flatMap(value => value.values || [value]);
          assert.deepEqual(ids, [...new Set(ids)].sort((a, b) => a - b));
          for (const id of ids) await lock(`product:${id}`);
        }
        return [];
      },
      product: {
        updateMany: async ({ where, data }: any) => {
          remember(where.id);
          const available = stock.get(where.id);
          if (available === undefined || available < where.stock.gte) return { count: 0 };
          stock.set(where.id, available - data.stock.decrement);
          mutations.push(where.id);
          return { count: 1 };
        },
        update: async ({ where, data }: any) => {
          remember(where.id);
          assert.ok(stock.has(where.id));
          stock.set(where.id, stock.get(where.id)! + data.stock.increment);
          mutations.push(where.id);
          return { id: where.id, stock: stock.get(where.id) };
        },
      },
    } as unknown as Prisma.TransactionClient;
    try {
      return await run(tx, async id => clone(documents.get(id) || []), (id, items) => {
        assert.ok(held.has(`document:${id}`), 'document mutation must follow document lock');
        if (!documentBefore.has(id)) documentBefore.set(id, clone(documents.get(id) || []));
        documents.set(id, clone(items));
      });
    } catch (error) {
      for (const [id, value] of before) {
        if (value === undefined) stock.delete(id); else stock.set(id, value);
      }
      for (const [id, items] of documentBefore) documents.set(id, items);
      throw error;
    } finally {
      for (const release of releases.reverse()) release();
    }
  }
  return { stock, documents, transaction, mutations };
}

test('quantities reject zero, negative, fraction, string and non-finite/out-of-range values', () => {
  for (const value of [0, -1, 1.5, '1', NaN, Infinity, null, undefined, 2_147_483_648]) {
    assert.throws(() => assertPositiveQuantity(value), (error: unknown) => error instanceof SaleStockError
      && error.status === 400 && error.code === 'INVALID_QUANTITY');
  }
  assert.doesNotThrow(() => assertPositiveQuantity(1));
  assert.doesNotThrow(() => assertPositiveQuantity(2_147_483_647));
});

test('sale items reject missing/empty lists, invalid IDs and duplicate products', () => {
  for (const items of [undefined, [], {}, [null], [{ productId: 0, quantity: 1 }],
    [{ productId: '1', quantity: 1 }], [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 2 }]]) {
    assert.throws(() => assertSaleItems(items), SaleStockError);
  }
  assert.doesNotThrow(() => assertSaleItems([{ productId: 1, quantity: 1 }]));
});

test('modeled competing transactions can sell the final unit only once', async () => {
  const store = memoryStore([[1, 1]]);
  const results = await Promise.allSettled([1, 2].map(() => store.transaction(tx =>
    deductSaleStock(tx, [{ productId: 1, quantity: 1 }]))));
  assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
  const rejected = results.find(result => result.status === 'rejected') as PromiseRejectedResult;
  assert.ok(isStockConflict(rejected.reason));
  assert.equal(store.stock.get(1), 0);
});

test('modeled transaction rolls back earlier deductions when a later product is unavailable', async () => {
  const store = memoryStore([[1, 2], [2, 0]]);
  await assert.rejects(store.transaction(tx => deductSaleStock(tx, [
    { productId: 2, quantity: 1 }, { productId: 1, quantity: 1 },
  ])), isStockConflict);
  assert.deepEqual(store.mutations, [1], 'failure must occur after a successful first deduction');
  assert.deepEqual([...store.stock], [[1, 2], [2, 0]]);
});

test('replacement returns removed quantities and deducts only positive net deltas', async () => {
  const store = memoryStore([[1, 0], [2, 5], [3, 3]]);
  await store.transaction(tx => replaceSaleStock(tx,
    [{ productId: 1, quantity: 4 }, { productId: 2, quantity: 2 }],
    [{ productId: 2, quantity: 4 }, { productId: 3, quantity: 1 }]));
  assert.deepEqual([...store.stock], [[1, 4], [2, 3], [3, 2]]);
  store.mutations.length = 0;
  await store.transaction(tx => replaceSaleStock(tx,
    [{ productId: 2, quantity: 4 }], [{ productId: 2, quantity: 4 }]));
  assert.deepEqual(store.mutations, [], 'unchanged quantities must not be restored/re-deducted');
});

test('modeled replacement failure rolls back both an earlier return and deduction', async () => {
  const store = memoryStore([[1, 0], [2, 3], [3, 0]]);
  await assert.rejects(store.transaction(tx => replaceSaleStock(tx,
    [{ productId: 1, quantity: 1 }],
    [{ productId: 2, quantity: 2 }, { productId: 3, quantity: 1 }])), isStockConflict);
  assert.deepEqual(store.mutations, [1, 2]);
  assert.deepEqual([...store.stock], [[1, 0], [2, 3], [3, 0]]);
});

test('modeled same-document updates reread under lock and do not double-deduct', async () => {
  const store = memoryStore([[1, 1]]);
  store.documents.set(10, [{ productId: 1, quantity: 1 }]);
  const update = () => store.transaction(async (tx, read, write) => {
    await lockSaleDocument(tx, 10);
    const current = await read(10);
    const next = [{ productId: 1, quantity: 2 }];
    await replaceSaleStock(tx, current, next);
    write(10, next);
  });
  await Promise.all([update(), update()]);
  assert.equal(store.stock.get(1), 0);
  assert.deepEqual(store.documents.get(10), [{ productId: 1, quantity: 2 }]);
  assert.deepEqual(store.mutations, [1]);
});

test('validateSaleItems rejects invalid API bodies without calling the handler', () => {
  for (const body of [undefined, {}, { items: [] }, ...[0, -1, 1.5, '1'].map(quantity => ({ items: [{ productId: 1, quantity }] })),
    { items: [{ productId: 1, quantity: 1 }, { productId: 1, quantity: 1 }] }]) {
    let status: number | undefined;
    let response: any;
    const res = { status(value: number) { status = value; return this; }, json(value: unknown) { response = value; } };
    validateSaleItems({ body } as any, res as any, () => assert.fail('invalid body must not reach handler'));
    assert.equal(status, 400);
    assert.equal(response.success, false);
    assert.equal(typeof response.code, 'string');
  }
});

test('validateSaleItems forwards valid API items exactly once without coercing them', () => {
  const items = [{ productId: 1, quantity: 2, price: 100 }];
  let calls = 0;
  validateSaleItems({ body: { items } } as any, { status: () => assert.fail('valid body must not be rejected') } as any,
    error => { assert.equal(error, undefined); calls++; });
  assert.equal(calls, 1);
  assert.deepEqual(items, [{ productId: 1, quantity: 2, price: 100 }]);
});
