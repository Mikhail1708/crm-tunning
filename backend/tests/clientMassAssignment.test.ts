import assert from 'node:assert/strict';
import test from 'node:test';
import express from 'express';
import jwt from 'jsonwebtoken';
import { AddressInfo } from 'node:net';
import { CRM_AUTH_COOKIE, CRM_JWT_AUDIENCE, CRM_JWT_ISSUER } from '../src/utils/authCookie';

const Module = require('node:module');
const originalLoad = Module._load;
let saved: any;
let row: any;
let currentUser: any;
const authGeneration = '11111111-1111-4111-8111-111111111111';
const audit: any[] = [];
const db = { user: { findUnique: async () => currentUser }, client: {
  findUnique: async () => row,
  findFirst: async () => null,
  update: async ({ data }: any) => {
    saved = data;
    for (const [key, value] of Object.entries(data)) if (value !== undefined) row[key] = value;
    return row;
  },
} };
Module._load = function(id: string, ...args: any[]) {
  if (id === '@prisma/client') return { PrismaClient: function() { return db; } };
  if (id.endsWith('/services/audit.service')) return { __esModule: true, default: { log: async (...args: any[]) => audit.push(args) } };
  return originalLoad.call(this, id, ...args);
};
let router: any;
try { router = require('../src/routes/clients.routes').default; }
finally { Module._load = originalLoad; }

async function request(body: any, role: string | null = 'manager') {
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'f25-fictional-test-signing-key';
  currentUser = role ? { id: 7, email: 'editor@example.test', name: 'Editor', role, authGeneration } : null;
  row = { id: 1, firstName: 'Old', middleName: 'Middle', phone: '123', discountPercent: 10,
    totalOrders: 4, totalSpent: 800, discountUpdatedBy: 3, createdAt: new Date('2020-01-01') };
  saved = undefined;
  audit.length = 0;
  const app = express();
  app.use(express.json());
  app.use(require('cookie-parser')());
  app.use('/api/clients', router);
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const token = role ? jwt.sign({ id: 7, name: 'Editor', role, authGeneration }, process.env.JWT_SECRET!, { expiresIn: '24h', issuer: CRM_JWT_ISSUER, audience: CRM_JWT_AUDIENCE }) : '';
    return await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/api/clients/1`, {
      method: 'PUT', headers: { 'Content-Type': 'application/json', Cookie: `${CRM_AUTH_COOKIE}=${token}` }, body: JSON.stringify(body),
    }).then(async res => ({ status: res.status, body: await res.json() }));
  } finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (previous === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previous;
  }
}

test('F25 legitimate manager client edit preserves allowed fields and conversions', async () => {
  const allowed = { firstName: 'New', lastName: 'Last', middleName: 'M', phone: '456', email: 'test@example.test',
    preferredContact: 'phone', address: 'Address', city: 'City', passport: 'fixture', driverLicense: 'fixture',
    carModel: 'Model', carVin: 'VIN', carNumber: 'Number', notes: 'Note', birthDate: '2000-01-01', carYear: '2020' };
  assert.equal((await request(allowed)).status, 200);
  for (const [key, value] of Object.entries(allowed)) if (!['birthDate', 'carYear'].includes(key)) assert.equal(saved[key], value);
  assert.equal(saved.birthDate.toISOString(), '2000-01-01T00:00:00.000Z');
  assert.equal(saved.carYear, 2020);
});

test('F25 protected client counters, ID and audit fields never reach Prisma', async () => {
  assert.equal((await request({ notes: 'Allowed', id: 99, totalOrders: 999, totalSpent: -1,
    createdAt: '2099-01-01', updatedAt: '2099-01-01', discountUpdatedAt: '2099-01-01', discountUpdatedBy: 999 })).status, 200);
  for (const key of ['id', 'totalOrders', 'totalSpent', 'createdAt', 'updatedAt']) assert.equal(Object.prototype.hasOwnProperty.call(saved, key), false);
  assert.equal(saved.discountUpdatedAt, undefined);
  assert.equal(saved.discountUpdatedBy, undefined);
  assert.equal(row.id, 1); assert.equal(row.totalSpent, 800); assert.equal(row.totalOrders, 4);
});

test('F25 nested orders cannot bypass payment/status/refund workflow and user relation cannot change role', async () => {
  assert.equal((await request({ notes: 'Allowed',
    orders: { updateMany: { where: {}, data: { paymentStatus: 'paid', orderStatus: 'cancelled', externalPaymentId: 'forged' } }, deleteMany: {} },
    updatedBy: { update: { role: 'admin' }, connect: { id: 99 } },
  })).status, 200);
  assert.equal(Object.prototype.hasOwnProperty.call(saved, 'orders'), false);
  assert.equal(Object.prototype.hasOwnProperty.call(saved, 'updatedBy'), false);
  assert.equal(saved.notes, 'Allowed');
});

for (const role of ['manager', 'admin']) test(`F25 ${role} discount edit uses authenticated author and server timestamp`, async () => {
  assert.equal((await request({ discountPercent: 25, discountUpdatedBy: 999, discountUpdatedAt: '2099-01-01' }, role)).status, 200);
  assert.equal(saved.discountPercent, 25);
  assert.equal(saved.discountUpdatedBy, 7);
  assert.ok(saved.discountUpdatedAt instanceof Date);
  assert.equal(audit[0][0].id, 7);
});

test('F25 unchanged discount does not permit audit identity spoofing', async () => {
  await request({ discountPercent: 10, discountUpdatedBy: 999 });
  assert.equal(saved.discountUpdatedBy, undefined);
  assert.equal(row.discountUpdatedBy, 3);
});

test('F25 public caller cannot access client update', async () => {
  assert.equal((await request({ notes: 'forged' }, null)).status, 401);
  assert.equal(saved, undefined);
});

test('F25 authenticated non-manager cannot access client update', async () => {
  assert.equal((await request({ notes: 'forged' }, 'viewer')).status, 403);
  assert.equal(saved, undefined);
});
