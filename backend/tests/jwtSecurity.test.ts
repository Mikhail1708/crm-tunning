import assert from 'node:assert/strict';
import { after, beforeEach, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { runInNewContext } from 'node:vm';
import ts from 'typescript';
import express from 'express';
import { AddressInfo } from 'node:net';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcryptjs';
import { getJwtSecret } from '../src/config/jwt';
import { newAuthGeneration, revokeUserTokens } from '../src/services/authRevocation.service';
import { CRM_AUTH_COOKIE, CRM_JWT_AUDIENCE, CRM_JWT_ISSUER } from '../src/utils/authCookie';

// Entire DB boundary is stubbed before loading real auth handlers. No dotenv or real DB.
const secret = 'f31-fictional-only-test-key-at-least-32-bytes';
const initialGeneration = '11111111-1111-4111-8111-111111111111';
const previousSecret = process.env.JWT_SECRET;
const previousEnv = process.env.NODE_ENV;
const Module = require('node:module');
const originalLoad = Module._load;
let currentUser: any;
let dbFailure: Error | undefined;
let lookups: any[] = [];
let updates: any[] = [];
let updateFailure: Error | undefined;
const db = { user: { findUnique: async (args: any) => {
  lookups.push(args);
  if (dbFailure) throw dbFailure;
  return currentUser;
}, update: async (args: any) => {
  if (updateFailure) throw updateFailure;
  assert.equal(args.where.id, currentUser.id);
  updates.push(args);
  currentUser.authGeneration = args.data.authGeneration;
  return { id: currentUser.id };
} } };
Module._load = function(id: string, ...args: any[]) {
  if (id === '@prisma/client') return { PrismaClient: function() { return db; } };
  return originalLoad.call(this, id, ...args);
};
let authMiddleware: any, adminMiddleware: any, managerAccess: any, login: any, logout: any, authRouter: any;
try {
  ({ authMiddleware, adminMiddleware, managerAccess } = require('../src/middleware/auth.middleware'));
  ({ login, logout } = require('../src/controllers/auth.controller'));
  authRouter = require('../src/routes/auth.routes').default;
} finally { Module._load = originalLoad; }

beforeEach(() => {
  process.env.JWT_SECRET = secret;
  process.env.NODE_ENV = 'test';
  currentUser = { id: 7, email: 'current@example.test', name: 'Current', role: 'admin', authGeneration: initialGeneration };
  lookups = []; dbFailure = undefined;
  updates = []; updateFailure = undefined;
});
after(() => {
  if (previousSecret === undefined) delete process.env.JWT_SECRET; else process.env.JWT_SECRET = previousSecret;
  if (previousEnv === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = previousEnv;
});

const token = (payload: any = {}, options: jwt.SignOptions = {}, key = secret) => jwt.sign(
  { id: 7, email: 'old@example.test', name: 'Old', role: 'admin', authGeneration: initialGeneration, ...payload }, key,
  { algorithm: 'HS256', expiresIn: '24h', issuer: CRM_JWT_ISSUER, audience: CRM_JWT_AUDIENCE, ...options },
);
const response = () => ({ statusCode: 200, body: undefined as any, cookieArgs: undefined as any,
  cleared: undefined as any,
  status(code: number) { this.statusCode = code; return this; },
  json(body: any) { this.body = body; return this; },
  cookie(...args: any[]) { this.cookieArgs = args; return this; },
  clearCookie(...args: any[]) { this.cleared = args; return this; },
});
async function authenticate(value: any = token(), bearer = false) {
  const req: any = { path: '/protected', originalUrl: '/api/protected',
    cookies: bearer ? {} : { [CRM_AUTH_COOKIE]: value },
    headers: bearer ? { authorization: `Bearer ${value}` } : {},
    body: { role: 'admin' }, query: { role: 'admin' },
  };
  const res = response(); let passed = false;
  await authMiddleware(req, res, () => { passed = true; });
  return { req, res, passed };
}
async function authorize(req: any, middleware: any) {
  const res = response(); let passed = false;
  await middleware(req, res, () => { passed = true; });
  return { res, passed };
}

for (const [label, value] of [['missing', undefined], ['empty', ''], ['whitespace', '   '], ['weak', 'short-test-value']] as const) {
  test(`F31 production startup rejects ${label} secret before app/workers start`, () => {
    const env = { NODE_ENV: 'production', JWT_SECRET: value };
    const transpile = (file: string) => ts.transpileModule(readFileSync(join(__dirname, '../src', file), 'utf8'), {
      compilerOptions: { module: ts.ModuleKind.CommonJS, esModuleInterop: true },
    }).outputText;
    const config: any = {};
    runInNewContext(transpile('config/jwt.ts'), { exports: config, process: { env }, Buffer });
    let appCreated = false;
    // Imports have no side effects in this harness. Execute the real startup statements.
    assert.throws(() => runInNewContext(transpile('server.ts'), {
      exports: {}, process: { env }, Buffer,
      require: (id: string) => {
        if (id === './config/jwt') return config;
        if (id === 'dotenv') return { config() {} };
        if (id === 'express') return () => { appCreated = true; throw new Error('app started'); };
        return {};
      },
    }), /JWT_SECRET (is required|must contain)/);
    assert.equal(appCreated, false);
  });
}
test('F31 production accepts supplied sufficiently long secret without changing its bytes', () => {
  assert.equal(getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: secret }), secret);
});
test('F31 development and test have no implicit fallback', () => {
  for (const NODE_ENV of ['development', 'test', undefined]) assert.throws(() => getJwtSecret({ NODE_ENV }), /required/);
});
test('F31 config rejection does not include rejected secret', () => {
  const rejected = 'private-fixture';
  assert.throws(() => getJwtSecret({ NODE_ENV: 'production', JWT_SECRET: rejected }), error =>
    error instanceof Error && !error.message.includes(rejected));
});

for (const role of ['admin', 'manager']) test(`F31 valid ${role} JWT keeps permitted access`, async () => {
  currentUser.role = role;
  const result = await authenticate(token({ role }));
  assert.equal(result.passed, true);
  assert.equal((await authorize(result.req, role === 'admin' ? adminMiddleware : managerAccess)).passed, true);
});
test('F31 old admin JWT loses admin access after downgrade but retains manager access', async () => {
  const oldToken = token();
  assert.equal((await authorize((await authenticate(oldToken)).req, adminMiddleware)).passed, true);
  currentUser.role = 'manager';
  const result = await authenticate(oldToken);
  assert.equal(result.passed, true);
  assert.deepEqual(result.req.user, { id: 7, email: currentUser.email, name: currentUser.name, role: 'manager' });
  assert.equal((await authorize(result.req, adminMiddleware)).res.statusCode, 403);
  assert.equal((await authorize(result.req, managerAccess)).passed, true);
});
test('F31 signed role and caller-supplied role cannot override current viewer', async () => {
  currentUser.role = 'viewer';
  const result = await authenticate();
  assert.equal((await authorize(result.req, managerAccess)).res.statusCode, 403);
  assert.equal((await authorize(result.req, adminMiddleware)).res.statusCode, 403);
});
test('F31 deleting the current user denies previously accepted JWT', async () => {
  const oldToken = token();
  assert.equal((await authenticate(oldToken)).passed, true);
  currentUser = null;
  const result = await authenticate(oldToken);
  assert.equal(result.passed, false); assert.equal(result.res.statusCode, 401);
  assert.equal(result.req.user, undefined);
  assert.ok(jwt.verify(oldToken, secret)); // Signature is still valid; identity access is revoked.
});
test('F31 DB lookup uses verified ID and selects no password or unrelated data', async () => {
  await authenticate();
  assert.deepEqual(lookups, [{ where: { id: 7 }, select: { id: true, email: true, name: true, role: true, authGeneration: true } }]);
});
test('F31 Bearer transport also uses current DB role', async () => {
  currentUser.role = 'manager';
  const result = await authenticate(token(), true);
  assert.equal(result.passed, true);
  assert.equal((await authorize(result.req, adminMiddleware)).res.statusCode, 403);
});
for (const [label, create] of [
  ['invalid signature', () => token({}, {}, 'different-fictional-key')],
  ['expired', () => token({}, { expiresIn: -1 })],
  ['malformed', () => 'malformed-token'],
  ['missing', () => ''],
  ['HS384', () => token({}, { algorithm: 'HS384' })],
  ['HS512', () => token({}, { algorithm: 'HS512' })],
  ['unsigned', () => token({}, { algorithm: 'none' }, '')],
  ['wrong issuer', () => token({}, { issuer: 'other-app' })],
  ['wrong audience', () => token({}, { audience: 'other-app' })],
] as Array<[string, () => string]>) test(`F31 rejects ${label} token before DB lookup`, async () => {
  const result = await authenticate(create());
  assert.equal(result.passed, false); assert.equal(result.res.statusCode, 401);
  assert.equal(lookups.length, 0);
});
for (const id of ['7garbage', 0, -1, 1.5, null, {}, Number.MAX_SAFE_INTEGER + 1]) test(`F31 rejects invalid identity ${JSON.stringify(id)}`, async () => {
  const result = await authenticate(token({ id }));
  assert.equal(result.passed, false); assert.equal(result.res.statusCode, 401);
  assert.equal(lookups.length, 0);
});
test('F31 accepts legacy numeric string ID without partial parsing', async () => {
  assert.equal((await authenticate(token({ id: '7' }))).passed, true);
  assert.equal(lookups[0].where.id, 7);
});
test('F31 DB outage fails closed and exposes no raw DB details or secrets over HTTP/logs', async () => {
  dbFailure = new Error(`Prisma private DB stack/meta ${secret}`);
  const logs: any[] = []; const oldError = console.error;
  console.error = (...args: any[]) => { logs.push(args); };
  const app = express();
  app.get('/admin', authMiddleware, adminMiddleware, (_req, res) => res.json({ accessed: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  try {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}/admin`, {
      headers: { Authorization: `Bearer ${token()}` },
    });
    assert.equal(res.status, 401);
    const output = await res.text();
    assert.equal(output.includes(secret), false);
    assert.doesNotMatch(output, /Prisma|stack|meta|accessed/);
    assert.equal(JSON.stringify(logs).includes(secret), false);
    assert.deepEqual(logs, [['Authentication failed']]);
  } finally {
    console.error = oldError;
    await new Promise<void>(resolve => server.close(() => resolve()));
  }
});
test('F31 failed auth discards pre-existing request identity', async () => {
  dbFailure = new Error('fictional DB failure');
  const req: any = { user: currentUser, headers: { authorization: `Bearer ${token()}` }, path: '/admin', originalUrl: '/api/admin' };
  let passed = false;
  await authMiddleware(req, response(), () => { passed = true; });
  assert.equal(passed, false); assert.equal(req.user, undefined);
});
test('F31 missing runtime config rejects valid token without leaking secret', async () => {
  const value = token(); delete process.env.JWT_SECRET;
  const result = await authenticate(value);
  assert.equal(result.passed, false); assert.equal(result.res.statusCode, 401);
  assert.equal(JSON.stringify(result.res.body).includes(secret), false);
  assert.equal(lookups.length, 0);
});
test('F31 real login signs HS256 with existing safe claims and 24h HttpOnly cookie', async () => {
  currentUser.password = await bcrypt.hash('fictional-password', 4);
  const res = response();
  await login({ body: { email: currentUser.email, password: 'fictional-password' } }, res);
  assert.equal(res.statusCode, 200);
  const [name, value, options] = res.cookieArgs;
  assert.equal(name, CRM_AUTH_COOKIE); assert.equal(options.httpOnly, true);
  assert.equal(options.maxAge, 86400000);
  const decoded = jwt.verify(value, secret, { algorithms: ['HS256'], issuer: CRM_JWT_ISSUER, audience: CRM_JWT_AUDIENCE }) as jwt.JwtPayload;
  assert.deepEqual(Object.keys(decoded).sort(), ['id', 'email', 'name', 'role', 'authGeneration', 'iat', 'exp', 'iss', 'aud'].sort());
  assert.equal(decoded.authGeneration, currentUser.authGeneration);
  assert.equal(decoded.exp! - decoded.iat!, 86400);
  assert.equal(res.body.token, undefined); assert.equal(res.body.user.password, undefined);
});
test('F31 invalid credentials never issue JWT', async () => {
  currentUser.password = await bcrypt.hash('fictional-password', 4);
  const res = response();
  await login({ body: { email: currentUser.email, password: 'wrong-password' } }, res);
  assert.equal(res.statusCode, 401); assert.equal(res.cookieArgs, undefined);
});
test('F31 logout rotates generation before clearing cookie and rejects copied JWT', async () => {
  const value = token(); const res = response();
  const { req } = await authenticate(value);
  const clearCookie = res.clearCookie;
  res.clearCookie = function(...args: any[]) {
    assert.notEqual(currentUser.authGeneration, initialGeneration);
    return clearCookie.apply(this, args);
  };
  await logout(req, res);
  assert.equal(res.cleared[0], CRM_AUTH_COOKIE);
  assert.ok(jwt.verify(value, secret));
  assert.equal((await authenticate(value)).res.statusCode, 401);
});
test('F31 password changes alone do not invalidate existing JWT (documented limitation)', async () => {
  const value = token();
  currentUser.password = 'fictional-new-password-hash';
  assert.ok(jwt.verify(value, secret));
  assert.equal((await authenticate(value)).passed, true);
});
test('F31 HTTP old admin token is forbidden after downgrade and rejected after deletion', async () => {
  const app = express();
  app.get('/admin', authMiddleware, adminMiddleware, (_req, res) => res.json({ ok: true }));
  app.get('/manager', authMiddleware, managerAccess, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const oldToken = token();
  const request = async (path: string) => {
    const res = await fetch(`http://127.0.0.1:${(server.address() as AddressInfo).port}${path}`, {
      headers: { Authorization: `Bearer ${oldToken}` },
    });
    await res.text(); return res.status;
  };
  try {
    assert.equal(await request('/admin'), 200);
    currentUser.role = 'manager';
    assert.equal(await request('/admin'), 403);
    assert.equal(await request('/manager'), 200);
    currentUser = null;
    assert.equal(await request('/admin'), 401);
    assert.equal(await request('/manager'), 401);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('F31 reusing a deleted ID with a fresh generation cannot reactivate old JWT', async () => {
  const oldToken = token();
  currentUser = null;
  assert.equal((await authenticate(oldToken)).passed, false);
  currentUser = { id: 7, email: 'restored@example.test', name: 'Restored', role: 'manager', authGeneration: newAuthGeneration() };
  const result = await authenticate(oldToken);
  assert.equal(result.passed, false);
  assert.equal(result.res.statusCode, 401);
  assert.equal(result.req.user, undefined);
});

for (const value of [undefined, null, 0, '', {}, 'invalid', '11111111-1111-1111-1111-111111111111']) {
  test(`F31 missing/malformed generation ${JSON.stringify(value)} is rejected before DB lookup`, async () => {
    const result = await authenticate(token({ authGeneration: value }));
    assert.equal(result.res.statusCode, 401); assert.equal(result.passed, false);
    assert.equal(lookups.length, 0);
  });
}
test('F31 validly signed JWT without expiration is rejected', async () => {
  const value = jwt.sign({ id: 7, authGeneration: initialGeneration }, secret, {
    issuer: CRM_JWT_ISSUER, audience: CRM_JWT_AUDIENCE,
  });
  assert.equal((await authenticate(value)).res.statusCode, 401);
  assert.equal(lookups.length, 0);
});
test('F31 mismatched generation returns generic 401 without either generation', async () => {
  const value = token(); currentUser.authGeneration = newAuthGeneration();
  const result = await authenticate(value);
  assert.equal(result.res.statusCode, 401); assert.equal(result.passed, false);
  assert.equal(JSON.stringify(result.res.body).includes(initialGeneration), false);
  assert.equal(JSON.stringify(result.res.body).includes(currentUser.authGeneration), false);
});
test('F31 real logout route revokes two sessions and new login uses current generation', async () => {
  currentUser.password = await bcrypt.hash('fictional-password', 4);
  const app = express(); app.use(express.json()); app.use(require('cookie-parser')());
  app.use('/api/auth', authRouter);
  app.get('/protected', authMiddleware, (_req, res) => res.json({ ok: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise<void>(resolve => server.once('listening', resolve));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const request = async (path: string, method: string, value?: string, body?: any) => {
    const res = await fetch(base + path, { method, headers: {
      'Content-Type': 'application/json', ...(value ? { Cookie: `${CRM_AUTH_COOKIE}=${value}` } : {}),
    }, body: body ? JSON.stringify(body) : undefined });
    await res.text(); return res;
  };
  try {
    const loginRes = await request('/api/auth/login', 'POST', undefined, { email: currentUser.email, password: 'fictional-password' });
    assert.equal(loginRes.status, 200);
    const first = loginRes.headers.get('set-cookie')!.match(new RegExp(`${CRM_AUTH_COOKIE}=([^;]+)`))![1];
    const second = token({ jti: 'second-session' });
    assert.equal((await request('/protected', 'GET', first)).status, 200);
    assert.equal((await request('/protected', 'GET', second)).status, 200);
    const loggedOut = await request('/api/auth/logout', 'POST', first, { userId: 999 });
    assert.equal(loggedOut.status, 200);
    assert.match(loggedOut.headers.get('set-cookie')!, /Expires=Thu, 01 Jan 1970/);
    assert.equal(updates[0].where.id, 7);
    assert.equal((await request('/protected', 'GET', first)).status, 401);
    assert.equal((await request('/protected', 'GET', second)).status, 401);
    assert.equal((await request('/api/auth/logout', 'POST', first)).status, 401);
    assert.equal((await request('/api/auth/logout', 'POST')).status, 401);
    assert.equal(updates.length, 1);
    const relogin = await request('/api/auth/login', 'POST', undefined, { email: currentUser.email, password: 'fictional-password' });
    assert.equal(relogin.status, 200);
    const fresh = relogin.headers.get('set-cookie')!.match(new RegExp(`${CRM_AUTH_COOKIE}=([^;]+)`))![1];
    assert.equal((jwt.verify(fresh, secret) as jwt.JwtPayload).authGeneration, currentUser.authGeneration);
    assert.equal((await request('/protected', 'GET', fresh)).status, 200);
  } finally { await new Promise<void>(resolve => server.close(() => resolve())); }
});
test('F31 logout write failure returns safe error without success or clearing cookie', async () => {
  const { req } = await authenticate();
  updateFailure = new Error(`Prisma stack meta ${secret} ${initialGeneration}`);
  const logs: any[] = []; const oldError = console.error;
  console.error = (...args: any[]) => { logs.push(args); };
  try {
    const res = response(); await logout(req, res);
    assert.equal(res.statusCode, 500); assert.equal(res.cleared, undefined);
    assert.equal(currentUser.authGeneration, initialGeneration);
    assert.deepEqual(logs, [['Logout failed']]);
    assert.equal(JSON.stringify(res.body).includes(secret), false);
    assert.equal(JSON.stringify(res.body).includes(initialGeneration), false);
    assert.doesNotMatch(JSON.stringify(res.body), /Prisma|stack|meta/);
  } finally { console.error = oldError; }
});
test('F31 concurrent revocations use atomic fresh-generation writes without read-modify-write', async () => {
  const oldToken = token();
  await Promise.all([revokeUserTokens(db as any, 7), revokeUserTokens(db as any, 7)]);
  assert.equal(lookups.length, 0); assert.equal(updates.length, 2);
  assert.notEqual(updates[0].data.authGeneration, updates[1].data.authGeneration);
  for (const update of updates) {
    assert.notEqual(update.data.authGeneration, initialGeneration);
    assert.deepEqual(Object.keys(update.data), ['authGeneration']);
    assert.deepEqual(update.select, { id: true });
  }
  assert.equal((await authenticate(oldToken)).res.statusCode, 401);
});
