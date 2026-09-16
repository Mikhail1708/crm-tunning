import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createProductImageRecord,
  deleteProductImageRecord,
  productImageBinaryPath,
  ProductImageUploadError,
  setMainProductImageRecord,
} from '../src/services/productImages.service';

const productId = 134;
const processed: any = {
  data: Buffer.from('processed fixture'), mimeType: 'image/png', size: 17,
  width: 1, height: 1, originalName: 'fixture.png', contentHash: 'fixture',
};
const image = (id: number, isMain = false, sortOrder = id) => ({
  id, productId, isMain, sortOrder, mimeType: 'image/png', url: null,
  filename: null, createdAt: new Date(), updatedAt: new Date(), ...processed,
});

// This models the row-lock protocol and rollback, NOT PostgreSQL isolation.
// Every image operation fails unless this transaction acquired the parent lock.
function fixture(initial: ReturnType<typeof image>[]) {
  let rows = initial.map((row) => ({ ...row }));
  let pointer: string | null = rows.some((row) => row.isMain)
    ? productImageBinaryPath(productId, rows.find((row) => row.isMain)!.id) : null;
  let nextId = Math.max(0, ...rows.map((row) => row.id)) + 1;
  let tail = Promise.resolve();
  let failPointerWrite = false;
  let exists = true;
  let lockCalls = 0;
  const match = (row: any, where: any = {}) => Object.entries(where).every(([key, value]: any) => (
    value && typeof value === 'object' && 'not' in value ? row[key] !== value.not : row[key] === value
  ));
  const transaction = async <T>(callback: (tx: any) => Promise<T>): Promise<T> => {
    let locked = false;
    let release: (() => void) | undefined;
    let snapshot: typeof rows | undefined;
    let previousPointer: string | null = null;
    const guard = () => assert.ok(locked, 'image access must follow Product FOR UPDATE');
    const tx: any = {
      $queryRaw: async (parts: TemplateStringsArray, ...values: unknown[]) => {
        assert.equal(locked, false, 'acquire parent lock once per mutation');
        assert.ok(Array.isArray(parts.raw), 'SQL must use a parameterized tagged template');
        assert.match(parts.join('?'), /SELECT\s+"id"\s+FROM\s+"Product"[\s\S]*FOR UPDATE/i);
        assert.deepEqual(values, [productId]);
        const previous = tail;
        tail = new Promise<void>((resolve) => { release = resolve; });
        await previous;
        locked = true;
        lockCalls += 1;
        snapshot = rows.map((row) => ({ ...row }));
        previousPointer = pointer;
        return exists ? [{ id: productId }] : [];
      },
      productImage: {
        count: async ({ where }: any) => { guard(); return rows.filter((row) => match(row, where)).length; },
        findFirst: async ({ where, orderBy }: any) => {
          guard(); const selected = rows.filter((row) => match(row, where));
          if (orderBy) selected.sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id);
          return selected[0] || null;
        },
        findMany: async ({ where, orderBy }: any) => {
          guard();
          assert.deepEqual(orderBy, [{ sortOrder: 'asc' }, { id: 'asc' }]);
          return rows.filter((row) => match(row, where))
            .sort((a, b) => a.sortOrder - b.sortOrder || a.id - b.id).map((row) => ({ ...row }));
        },
        create: async ({ data }: any) => { guard(); const row = { ...image(nextId++), ...data }; rows.push(row); return { ...row }; },
        update: async ({ where, data }: any) => {
          guard(); const row = rows.find((candidate) => match(candidate, where));
          assert.ok(row, 'update target exists'); Object.assign(row, data); return { ...row };
        },
        updateMany: async ({ where, data }: any) => {
          guard(); const selected = rows.filter((row) => match(row, where));
          selected.forEach((row) => Object.assign(row, data)); return { count: selected.length };
        },
        delete: async ({ where }: any) => {
          guard(); const index = rows.findIndex((row) => match(row, where));
          assert.ok(index >= 0); return rows.splice(index, 1)[0];
        },
      },
      product: {
        update: async ({ data }: any) => {
          guard(); if (failPointerWrite) throw new Error('injected pointer write failure');
          pointer = data.image_url; return { id: productId, image_url: pointer };
        },
      },
    };
    try { return await callback(tx); }
    catch (error) { if (snapshot) { rows = snapshot; pointer = previousPointer; } throw error; }
    finally { release?.(); }
  };
  const invariant = () => {
    assert.ok(rows.length <= 5);
    const main = rows.filter((row) => row.isMain);
    assert.equal(main.length, rows.length ? 1 : 0);
    assert.equal(pointer, main.length ? productImageBinaryPath(productId, main[0].id) : null);
  };
  return {
    transaction, invariant, rows: () => rows, pointer: () => pointer,
    lockCalls: () => lockCalls,
    failPointer: () => { failPointerWrite = true; },
    removeProduct: () => { exists = false; },
    upload: () => transaction((tx) => createProductImageRecord(tx, productId, processed)),
    remove: (id: number) => transaction((tx) => deleteProductImageRecord(tx, productId, id)),
    main: (id: number) => transaction((tx) => setMainProductImageRecord(tx, productId, id)),
  };
}

describe('F26 Product parent-lock protocol (in-memory regression, not PostgreSQL)', () => {
  it('permits only one of two uploads when four images exist', async () => {
    const db = fixture([image(1, true), image(2), image(3), image(4)]);
    const result = await Promise.allSettled([db.upload(), db.upload()]);
    assert.equal(result.filter((entry) => entry.status === 'fulfilled').length, 1);
    const rejected = result.find((entry) => entry.status === 'rejected') as PromiseRejectedResult;
    assert.ok(rejected.reason instanceof ProductImageUploadError);
    assert.equal(rejected.reason.status, 400);
    assert.equal(db.rows().length, 5); assert.equal(db.lockCalls(), 2); db.invariant();
  });
  it('serializes two first uploads into exactly one main', async () => {
    const db = fixture([]); await Promise.all([db.upload(), db.upload()]);
    assert.equal(db.rows().length, 2); db.invariant();
  });
  it('rejects upload if Product no longer exists after obtaining lock', async () => {
    const db = fixture([]); db.removeProduct();
    await assert.rejects(db.upload(), (error: unknown) => (
      error instanceof ProductImageUploadError && error.status === 404
    ));
    assert.equal(db.rows().length, 0); db.invariant();
  });
  it('chooses replacement by sortOrder then id, independently of insertion order', async () => {
    const db = fixture([image(1, true, 0), image(9, false, 1), image(3, false, 1)]);
    await db.remove(1); assert.equal(db.rows().find((row) => row.isMain)?.id, 3); db.invariant();
  });
  it('deleting the last image clears the Product pointer', async () => {
    const db = fixture([image(1, true)]); await db.remove(1); db.invariant();
  });
  it('set-main sets exactly one main and its corresponding Product pointer', async () => {
    const db = fixture([image(1, true), image(2)]); await db.main(2);
    assert.equal(db.rows().find((row) => row.isMain)?.id, 2); db.invariant();
  });
  for (const order of ['forward', 'reverse'] as const) {
    for (const scenario of ['upload-delete-last', 'delete-set-main', 'delete-main-set-other', 'two-deletes', 'two-set-main'] as const) {
      it(`${scenario}: invariants survive ${order} lock acquisition`, async () => {
        const db = fixture(scenario === 'upload-delete-last'
          ? [image(1, true)] : [image(1, true), image(2), image(3)]);
        const operations = scenario === 'upload-delete-last' ? [() => db.upload(), () => db.remove(1)]
          : scenario === 'delete-set-main' ? [() => db.remove(2), () => db.main(2)]
          : scenario === 'delete-main-set-other' ? [() => db.remove(1), () => db.main(3)]
          : scenario === 'two-deletes' ? [() => db.remove(1), () => db.remove(2)]
          : [() => db.main(2), () => db.main(3)];
        if (order === 'reverse') operations.reverse();
        const outcomes = await Promise.allSettled(operations.map((operation) => operation()));
        assert.equal(outcomes.filter((result) => result.status === 'rejected').length,
          scenario === 'delete-set-main' && order === 'forward' ? 1 : 0);
        db.invariant();
      });
    }
  }
  for (const operation of ['upload', 'delete', 'set-main'] as const) {
    it(`${operation}: pointer write failure rolls back image mutations`, async () => {
      const db = fixture([image(1, true), image(2)]);
      const before = db.rows().map((row) => ({ ...row })); const pointer = db.pointer();
      db.failPointer();
      await assert.rejects(operation === 'upload' ? db.upload() : operation === 'delete' ? db.remove(1) : db.main(2));
      assert.deepEqual(db.rows(), before); assert.equal(db.pointer(), pointer); db.invariant();
    });
  }
});
