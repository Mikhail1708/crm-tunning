import assert from 'node:assert/strict';
import test from 'node:test';
import { Prisma } from '@prisma/client';

const Module = require('node:module');
const originalLoad = Module._load;
const originalInterval = global.setInterval;
let listArgs: any, countArgs: any;
const rows = Array.from({ length: 61 }, (_, id) => ({ id: id + 1, clientId: 7, saleDate: new Date('2026-01-01') }));
const db = { saleDocument: {
  findMany: async (args: any) => {
    listArgs = args;
    assert.ok(args.take > 0 && args.take <= 200);
    assert.deepEqual(args.orderBy, [{ saleDate: 'desc' }, { id: 'desc' }]);
    return [...rows].reverse().filter(row => !args.where.clientId || row.clientId === args.where.clientId).slice(args.skip, args.skip + args.take);
  },
  count: async (args: any) => { countArgs = args; return rows.filter(row => !args.where.clientId || row.clientId === args.where.clientId).length; },
} };
Module._load = function (id: string, ...args: any[]) {
  if (id === '@prisma/client') return { Prisma, PrismaClient: function () { return db; } };
  return originalLoad.call(this, id, ...args);
};
global.setInterval = (() => ({ unref() {} })) as any;
let handlers: any;
try { handlers = require('../src/controllers/saleDocuments.controller'); }
finally { Module._load = originalLoad; global.setInterval = originalInterval; }
async function invoke(name: string, query: any = {}, params: any = {}) {
  const response = { code: 200, body: undefined as any, headers: {} as any,
    status(code: number) { this.code = code; return this; },
    json(body: any) { this.body = body; return this; },
    setHeader(key: string, value: string) { this.headers[key] = value; },
  };
  await handlers[name]({ query, params }, response);
  return response;
}
test('document controller passes bounded page and same filter to full count', async () => {
  const result = await invoke('getSaleDocuments', { page: '2', limit: '10', paymentStatus: 'paid' });
  assert.equal(result.code, 200); assert.equal(listArgs.take, 10); assert.equal(listArgs.skip, 10);
  assert.equal(result.headers['X-Total-Count'], '61');
  assert.deepEqual(countArgs.where, listArgs.where);
  assert.equal(listArgs.where.paymentStatus, 'paid');
  assert.deepEqual(result.body.map((row: any) => row.id), [51, 50, 49, 48, 47, 46, 45, 44, 43, 42]);
});
test('client documents bounded with total independent of page and client query override', async () => {
  const result = await invoke('getDocumentsByClient', { page: '2', limit: '50', clientId: '8' }, { clientId: '7' });
  assert.equal(result.body.length, 11); assert.equal(result.headers['X-Total-Count'], '61');
  assert.equal(listArgs.where.clientId, 7); assert.equal(listArgs.take, 50);
});
test('client document huge limit clamps and malformed route remains 400', async () => {
  await invoke('getDocumentsByClient', { limit: '1000000000' }, { clientId: '7' });
  assert.equal(listArgs.take, 200);
  assert.equal((await invoke('getDocumentsByClient', {}, { clientId: 'bad' })).code, 400);
});
