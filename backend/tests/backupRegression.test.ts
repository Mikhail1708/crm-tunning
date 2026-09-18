import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';
import { BackupError, exportDatabaseBackup, restoreDatabaseBackup, clearBackupTables, lockBackupTables, assertSalesHistoryCanBeCleared } from '../src/services/databaseBackup.service';

const models: Record<string, string> = {
  users: 'user', categories: 'category', categoryFields: 'categoryField', products: 'product', productCategories: 'productCategory',
  productCharacteristics: 'productCharacteristic', clients: 'client', saleDocuments: 'saleDocument', saleDocumentItems: 'saleDocumentItem',
  sales: 'sale', expenses: 'expense', productImages: 'productImage', priceHistory: 'priceHistory', inventoryReservations: 'inventoryReservation',
  inventoryReservationItems: 'inventoryReservationItem', crmStatusOutboxEvents: 'crmStatusOutboxEvent',
};
const runtime = ['productImages', 'priceHistory', 'inventoryReservations', 'inventoryReservationItems', 'crmStatusOutboxEvents'];
const emptyDump = (version = '4.0'): any => ({ version, data: Object.fromEntries(Object.keys(models).filter(key => version === '4.0' || !runtime.includes(key)).map(key => [key, []])) });

function memoryDb(initial: Record<string, any[]> = {}, failModel?: string) {
  let state = Object.fromEntries(Object.values(models).map(model => [model, structuredClone(initial[model] || [])]));
  let sequences: Record<string, number> = { User: 17, Category: 23 };
  const events: string[] = [];
  const options: any[] = [];
  const tx: any = {};
  for (const model of Object.values(models)) tx[model] = {
    findMany: async (args?: any) => { events.push(`read:${model}`); return structuredClone(args?.where?.role ? state[model].filter(row => row.role === args.where.role) : state[model]); },
    count: async () => { events.push(`count:${model}`); return state[model].length; },
    findFirst: async () => [...state[model]].sort((a, b) => a.id - b.id).find(row => row.role === 'admin') || null,
    deleteMany: async () => {
      events.push(`delete:${model}`);
      // Restrict-style FK checks make a wrong clear order fail this fixture.
      if (model === 'product') for (const child of ['inventoryReservationItem', 'saleDocumentItem', 'sale', 'priceHistory']) assert.equal(state[child].length, 0, `${child} must precede product`);
      if (model === 'saleDocument') assert.equal(state.inventoryReservation.length, 0, 'reservation must precede document');
      state[model] = model === 'user' ? state[model].filter(row => row.role === 'admin') : [];
      return { count: 1 };
    },
    create: async ({ data }: any) => {
      events.push(`create:${model}`);
      if (model === failModel) throw new Error('FICTIONAL_DB_DETAIL');
      if (model === 'product' && data.costBreakdown === null) throw new Error('Prisma nullable JSON requires DbNull');
      if (model === 'inventoryReservation' && data.saleDocumentId) assert.ok(state.saleDocument.some(row => row.id === data.saleDocumentId));
      if (model === 'inventoryReservationItem') {
        assert.ok(state.inventoryReservation.some(row => row.id === data.reservationId));
        assert.ok(state.product.some(row => row.id === data.productId));
      }
      const references: Record<string, [string, string][]> = {
        saleDocument: [['clientId', 'client'], ['createdBy', 'user']],
        saleDocumentItem: [['documentId', 'saleDocument'], ['productId', 'product']],
        sale: [['documentId', 'saleDocument'], ['productId', 'product']],
        crmStatusOutboxEvent: [['saleDocumentId', 'saleDocument']],
        productImage: [['productId', 'product']], priceHistory: [['productId', 'product'], ['changedBy', 'user']],
        categoryField: [['categoryId', 'category']], productCategory: [['productId', 'product'], ['categoryId', 'category']],
        productCharacteristic: [['productId', 'product'], ['fieldId', 'categoryField']], client: [['discountUpdatedBy', 'user']],
      };
      for (const [field, parent] of references[model] || []) {
        if (data[field] != null) assert.ok(state[parent].some(row => row.id === data[field]), `${model}.${field} FK`);
      }
      state[model].push(structuredClone(data)); return data;
    },
  };
  tx.$executeRaw = async (sql: any) => {
    events.push(Array.isArray(sql) ? 'lock' : sql.sql);
    const match = sql.sql?.match(/^ALTER SEQUENCE "(.+)_id_seq" RESTART WITH (\d+)$/);
    if (match) {
      if (failModel === 'sequence' && match[1] === 'Category') throw new Error('FICTIONAL_SEQUENCE_FAILURE');
      sequences[match[1]] = Number(match[2]);
    }
    return 0;
  };
  tx.$queryRaw = async () => [{ next: 100 }];
  const db: any = { ...tx, $transaction: async (callback: Function, config: any) => {
    const before = structuredClone(state); const beforeSequences = { ...sequences }; options.push(config);
    try { return await callback(tx); }
    catch (error) { state = before; sequences = beforeSequences; events.push('rollback'); throw error; }
  } };
  return { db, tx, events, options, state: () => state, sequences: () => sequences };
}

test('v4 export uses one repeatable-read snapshot and roundtrips runtime BigInt/binary records', async () => {
  const oldGeneration = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const fixture = {
    user: [{ id: 7, role: 'manager', authGeneration: oldGeneration }], product: [{ id: 2, image_url: '/api/products/images/4' }],
    saleDocument: [{ id: 3, paidAmountMinor: 9007199254740993n, createdBy: 7 }],
    inventoryReservation: [{ id: 'reservation', totalMinor: 9007199254740993n, paidAmountMinor: 9007199254740993n, saleDocumentId: 3 }],
    inventoryReservationItem: [{ reservationId: 'reservation', productId: 2, unitPriceMinor: 9007199254740993n, totalMinor: 9007199254740993n }],
    productImage: [{ id: 4, productId: 2, data: Buffer.from([0, 255, 10, 128]), isMain: true }],
    priceHistory: [{ id: 5, productId: 2, changedBy: 7, oldPrice: 1, newPrice: 2 }],
    crmStatusOutboxEvent: [{ id: 'event', payload: { status: 'shipped' }, deliveryStatus: 'processing', lockedAt: new Date() }],
  };
  const source = memoryDb(fixture);
  const dump = await exportDatabaseBackup(source.db);
  assert.equal(source.options[0].isolationLevel, Prisma.TransactionIsolationLevel.RepeatableRead);
  assert.equal(Object.keys(dump.data).length, 16);
  assert.equal(dump.data.saleDocuments[0].paidAmountMinor, '9007199254740993');
  assert.equal(dump.data.productImages[0].data, 'AP8KgA==');
  const target = memoryDb();
  await restoreDatabaseBackup(target.db, JSON.parse(JSON.stringify(dump)));
  assert.equal(target.events[0], 'lock');
  assert.equal(target.state().saleDocument[0].paidAmountMinor, 9007199254740993n);
  assert.equal(target.state().inventoryReservationItem[0].unitPriceMinor, 9007199254740993n);
  assert.deepEqual(Buffer.from(target.state().productImage[0].data), Buffer.from(fixture.productImage[0].data));
  assert.equal(target.state().priceHistory[0].changedBy, 7);
  assert.notEqual(target.state().user[0].authGeneration, oldGeneration);
  assert.equal(target.state().crmStatusOutboxEvent[0].deliveryStatus, 'pending');
  assert.equal(target.state().crmStatusOutboxEvent[0].lockedAt, null);
  assert.equal(target.state().crmStatusOutboxEvent[0].id, 'event');
  assert.equal(target.events.filter(value => value.startsWith('ALTER SEQUENCE')).length, 12);
  assert.ok(target.events.every(value => !value.includes('setval')));
});

test('clear deletes restrict children before parents and preserves admins', async () => {
  const store = memoryDb({ user: [{ id: 1, role: 'admin' }, { id: 2, role: 'manager' }], product: [{ id: 1 }],
    inventoryReservation: [{ id: 'r' }], inventoryReservationItem: [{ productId: 1 }],
    saleDocument: [{ id: 1 }], saleDocumentItem: [{ productId: 1 }], sale: [{ productId: 1 }], priceHistory: [{ productId: 1 }] });
  await store.db.$transaction(async (tx: any) => { await lockBackupTables(tx); await clearBackupTables(tx); });
  assert.equal(store.events[0], 'lock');
  assert.deepEqual(store.state().user, [{ id: 1, role: 'admin' }]);
  for (const [model, rows] of Object.entries(store.state())) if (model !== 'user') assert.equal(rows.length, 0);
});

test('v3 requires explicit policy before touching database', async () => {
  const store = memoryDb();
  await assert.rejects(restoreDatabaseBackup(store.db, emptyDump('3.0')), (error: any) => error instanceof BackupError && error.status === 409);
  assert.deepEqual(store.events, []);
});
for (const key of runtime) test(`v3 refuses loss of existing ${key} after lock before delete`, async () => {
  const store = memoryDb({ [models[key]]: [{ id: 1 }] });
  const dump = { ...emptyDump('3.0'), legacyRuntimePolicy: 'require-empty' };
  await assert.rejects(restoreDatabaseBackup(store.db, dump), (error: any) => error instanceof BackupError && error.status === 409);
  assert.equal(store.events[0], 'lock');
  assert.ok(!store.events.some(value => value.startsWith('delete:')));
  assert.equal(store.state()[models[key]].length, 1);
});
test('v3 explicit require-empty with empty runtime tables succeeds', async () => {
  const store = memoryDb();
  await restoreDatabaseBackup(store.db, { ...emptyDump('3.0'), legacyRuntimePolicy: 'require-empty' });
  assert.ok(store.events.includes('delete:product'));
});
for (const key of runtime) test(`v3 rejects supplied ${key} instead of dropping its rows`, async () => {
  const store = memoryDb();
  const dump = { ...emptyDump('3.0'), legacyRuntimePolicy: 'require-empty' };
  dump.data[key] = [{ id: 1 }];
  await assert.rejects(restoreDatabaseBackup(store.db, dump), (error: any) => error instanceof BackupError && error.status === 400);
  assert.deepEqual(store.events, []);
});
test('failure during sequence restart rolls back earlier restarts and restored data', async () => {
  const store = memoryDb({ product: [{ id: 99 }] }, 'sequence');
  const dump = emptyDump(); dump.data.products = [{ id: 1 }];
  await assert.rejects(restoreDatabaseBackup(store.db, dump), /FICTIONAL_SEQUENCE_FAILURE/);
  assert.deepEqual(store.state().product, [{ id: 99 }]);
  assert.deepEqual(store.sequences(), { User: 17, Category: 23 });
  assert.ok(store.events.includes('ALTER SEQUENCE "User_id_seq" RESTART WITH 100'));
  assert.equal(store.events.at(-1), 'rollback');
});
test('nullable product JSON is normalized for Prisma and non-null JSON is preserved', async () => {
  const store = memoryDb(); const dump = emptyDump();
  dump.data.products = [{ id: 1, costBreakdown: null }, { id: 2, costBreakdown: [{ cost: 3 }] }];
  const creates: any[] = [];
  store.tx.product.create = async ({ data }: any) => { creates.push(data); return data; };
  await restoreDatabaseBackup(store.db, dump);
  assert.equal(creates[0].costBreakdown, Prisma.DbNull);
  assert.deepEqual(creates[1].costBreakdown, [{ cost: 3 }]);
  assert.equal(dump.data.products[0].costBreakdown, null);
});
test('multiple backup admins remain distinct when no current admins are preserved', async () => {
  const store = memoryDb(); const dump = emptyDump();
  dump.data.users = [{ id: 1, email: 'a@example.test', role: 'admin' }, { id: 2, email: 'b@example.test', role: 'admin' }];
  await restoreDatabaseBackup(store.db, dump);
  assert.deepEqual(store.state().user.map(row => row.id), [1, 2]);
});
test('missing mandatory v4 and legacy tables fail before transaction', async () => {
  for (const version of ['3.0', '4.0']) {
    const store = memoryDb(); const dump = emptyDump(version); delete dump.data.products;
    await assert.rejects(restoreDatabaseBackup(store.db, dump), (error: any) => error.status === 400);
    assert.equal(store.options.length, 0);
  }
});
test('restore failure rolls back deletes and inserts, retaining original dataset', async () => {
  const store = memoryDb({ product: [{ id: 99 }] }, 'product');
  const dump = emptyDump(); dump.data.products = [{ id: 1 }];
  await assert.rejects(restoreDatabaseBackup(store.db, dump), /FICTIONAL_DB_DETAIL/);
  assert.deepEqual(store.state().product, [{ id: 99 }]);
  assert.ok(store.events.includes('rollback'));
});
test('preserved admin credentials remain unchanged and restored foreign keys remap', async () => {
  const admin = { id: 42, role: 'admin', password: 'current-fictional-hash', authGeneration: 'current-generation' };
  const store = memoryDb({ user: [admin] });
  const dump = emptyDump(); dump.data.users = [{ id: 1, role: 'admin', password: 'dump-hash' }, { id: 2, role: 'manager', authGeneration: 'old' }];
  dump.data.clients = [{ id: 3, discountUpdatedBy: 1 }];
  dump.data.saleDocuments = [{ id: 4, createdBy: 1 }];
  dump.data.priceHistory = [{ id: 5, changedBy: 1 }];
  await restoreDatabaseBackup(store.db, dump);
  assert.deepEqual(store.state().user[0], admin);
  assert.notEqual(store.state().user[1].authGeneration, 'old');
  assert.equal(store.state().client[0].discountUpdatedBy, 42);
  assert.equal(store.state().saleDocument[0].createdBy, 42);
  assert.equal(store.state().priceHistory[0].changedBy, 42);
});
for (const model of ['inventoryReservation', 'crmStatusOutboxEvent']) test(`history purge refuses ${model}`, async () => {
  const store = memoryDb({ [model]: [{ id: 'x' }] });
  await assert.rejects(assertSalesHistoryCanBeCleared(store.tx), (error: any) => error instanceof BackupError && error.status === 409);
  assert.ok(!store.events.some(value => value.startsWith('delete:')));
});
test('history purge guard permits empty runtime tables', async () => { await assertSalesHistoryCanBeCleared(memoryDb().tx); });
test('malformed monetary or binary data rolls back without exposing DB errors', async () => {
  for (const [key, row] of [['saleDocuments', { id: 1, paidAmountMinor: '1.5' }], ['saleDocuments', { id: 1, paidAmountMinor: Number.MAX_SAFE_INTEGER + 1 }], ['productImages', { id: 1, data: '***' }]] as const) {
    const store = memoryDb({ product: [{ id: 99 }] }); const dump = emptyDump(); dump.data[key] = [row];
    await assert.rejects(restoreDatabaseBackup(store.db, dump), (error: any) => error instanceof BackupError && error.status === 400);
    assert.deepEqual(store.state().product, [{ id: 99 }]);
  }
});
test('broken restored reservation FK aborts replacement and preserves old dataset', async () => {
  const store = memoryDb({ saleDocument: [{ id: 99 }], inventoryReservation: [{ id: 'old', saleDocumentId: 99 }] });
  const dump = emptyDump();
  dump.data.inventoryReservations = [{ id: 'new', saleDocumentId: 123 }];
  await assert.rejects(restoreDatabaseBackup(store.db, dump));
  assert.deepEqual(store.state().saleDocument, [{ id: 99 }]);
  assert.deepEqual(store.state().inventoryReservation, [{ id: 'old', saleDocumentId: 99 }]);
});
