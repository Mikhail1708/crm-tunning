import assert from 'node:assert/strict';
import test from 'node:test';

// Real controllers/services, isolated dependencies. Never load or write audit.log.
const Module = require('node:module');
const originalLoad = Module._load;
let selected: any;
let counted: any;
const db = {
  client: {
    findMany: async (args: any) => { selected = args; return [{ id: 1 }]; },
    count: async (args: any) => { counted = args; return 1234; },
  },
  product: {
    findMany: async (args: any) => { selected = args; return []; },
    count: async (args: any) => { counted = args; return 4321; },
  },
};
Module._load = function(id: string, ...args: any[]) {
  if (id === '@prisma/client') return { PrismaClient: function() { return db; } };
  if (id === 'fs') return {
    existsSync: () => true,
    readFileSync: () => '',
    appendFileSync: () => assert.fail('unexpected audit write'),
    writeFileSync: () => assert.fail('unexpected audit write'),
    mkdirSync: () => assert.fail('unexpected mkdir'),
  };
  return originalLoad.call(this, id, ...args);
};
let audit: any, auditController: any, clients: any, publicApi: any;
try {
  audit = require('../src/services/audit.service').default;
  auditController = require('../src/controllers/audit.controller');
  clients = require('../src/controllers/clients.controller');
  publicApi = require('../src/controllers/public.controller');
} finally { Module._load = originalLoad; }
audit.logs = Array.from({ length: 10000 }, (_, id) => ({
  id, userId: 1, userName: 'Fixture', userRole: 'manager', action: 'fixture',
  details: {}, createdAt: new Date('2026-01-01'),
}));

async function invoke(handler: Function, query: any) {
  const res = { statusCode: 200, body: undefined as any,
    status(code: number) { this.statusCode = code; return this; },
    json(body: any) { this.body = body; }, setHeader() {},
  };
  await handler({ query }, res);
  assert.equal(res.statusCode, 200);
  return res.body;
}

for (const input of [undefined, '-1', '0', 'abc', '1.5', 'Infinity', '1000000000', '500']) {
  test(`audit controller and service bounds ${input}`, async () => {
    const large = input === '1000000000' || input === '500';
    const logs = await invoke(auditController.getLogs, { limit: input });
    assert.equal(logs.logs.length, large ? 500 : 100);
    assert.equal(logs.total, 10000);
    assert.equal(audit.getLogs({ limit: input }).logs.length, large ? 500 : 100);
    assert.equal((await invoke(auditController.getRecentLogs, { limit: input })).length, large ? 100 : 20);
    assert.equal(audit.getRecent(input).length, large ? 100 : 20);
  });
}
test('audit full total, subsequent page, export and stats remain complete', () => {
  const result = audit.getLogs({ page: 2, limit: 100 });
  assert.equal(result.logs[0].id, 100);
  assert.equal(result.total, 10000);
  assert.equal(audit.getStats().total, 10000);
  assert.equal(audit.exportToCSV().split('\n').length, 10001);
});

for (const [name, handler, defaultLimit, maxLimit] of [
  ['clients', clients.getAllClients, 20, 1000],
  ['public', publicApi.getPublicProducts, 12, 100],
] as const) {
  for (const input of [undefined, '-1', '0', 'abc', '1.5', 'Infinity', '1000000000', String(maxLimit)]) {
    test(`${name}: normalized take/skip and full filtered total (${input})`, async () => {
      const large = input === '1000000000' || input === String(maxLimit);
      const response = await invoke(handler, { page: '2', limit: input, search: 'fixture' });
      assert.equal(selected.take, large ? maxLimit : defaultLimit);
      assert.equal(selected.skip, selected.take);
      assert.deepEqual(selected.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
      assert.deepEqual(counted.where, selected.where);
      assert.ok(selected.where.OR.length > 0);
      assert.equal(response.total, name === 'clients' ? 1234 : 4321);
      assert.equal(response.page, 2);
      assert.equal(response.limit, selected.take);
    });
  }
  for (const page of ['-1', '0', 'abc', '1.5', 'Infinity', '9007199254740992', '1000000000']) {
    test(`${name}: invalid/overflow page ${page}`, async () => {
      await invoke(handler, { page });
      assert.equal(selected.skip, 0);
      assert.equal(selected.take, defaultLimit);
    });
  }
}
test('clients sort allowlist preserves legitimate sort and rejects arbitrary fields', async () => {
  for (const sortBy of ['createdAt', 'totalSpent', 'totalOrders', 'lastName', 'city', 'discountPercent']) {
    await invoke(clients.getAllClients, { sortBy, sortOrder: 'asc' });
    assert.deepEqual(selected.orderBy, [{ [sortBy]: 'asc' }, { id: 'asc' }]);
  }
  await invoke(clients.getAllClients, { sortBy: 'unknown', sortOrder: 'invalid' });
  assert.deepEqual(selected.orderBy, [{ createdAt: 'desc' }, { id: 'desc' }]);
});
