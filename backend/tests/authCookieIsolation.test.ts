import assert from 'node:assert/strict';
import { after, before, describe, it } from 'node:test';
import jwt from 'jsonwebtoken';
import { authMiddleware, managerAccess } from '../src/middleware/auth.middleware';
import { CRM_AUTH_COOKIE, CRM_JWT_AUDIENCE, CRM_JWT_ISSUER } from '../src/utils/authCookie';

const previousJwtSecret = process.env.JWT_SECRET;
const testJwtSecret = 'crm-auth-cookie-isolation-test-secret';

before(() => {
  process.env.JWT_SECRET = testJwtSecret;
});

after(() => {
  if (previousJwtSecret === undefined) {
    delete process.env.JWT_SECRET;
  } else {
    process.env.JWT_SECRET = previousJwtSecret;
  }
});

const responseStub = () => {
  const result = {
    statusCode: 200,
    body: undefined as unknown,
    status(code: number) {
      this.statusCode = code;
      return this;
    },
    json(body: unknown) {
      this.body = body;
      return this;
    },
  };
  return result;
};

describe('CRM auth cookie isolation', () => {
  it('uses a CRM-specific cookie name', () => {
    assert.equal(CRM_AUTH_COOKIE, 'swapservice38-crm-token');
    assert.notEqual(CRM_AUTH_COOKIE, 'token');
  });

  it('ignores a generic website token cookie', async () => {
    const websiteToken = jwt.sign({ id: 'website-user', cv: 'version' }, testJwtSecret);
    const req = {
      cookies: { token: websiteToken },
      headers: {},
      path: '/134/images',
      originalUrl: '/api/products/134/images',
    } as any;
    const res = responseStub();
    let nextCalled = false;

    await authMiddleware(req, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  it('rejects a website JWT even if it is placed in the CRM cookie', async () => {
    const websiteToken = jwt.sign({ id: 'website-user', cv: 'version' }, testJwtSecret);
    const req = {
      cookies: { [CRM_AUTH_COOKIE]: websiteToken },
      headers: {},
      path: '/134/images',
      originalUrl: '/api/products/134/images',
    } as any;
    const res = responseStub();
    let nextCalled = false;

    await authMiddleware(req, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 401);
  });

  for (const role of ['admin', 'manager']) {
    it(`allows an authenticated ${role} through product edit authorization`, async () => {
      const token = jwt.sign(
        { id: 7, email: `${role}@example.test`, name: role, role },
        testJwtSecret,
        { issuer: CRM_JWT_ISSUER, audience: CRM_JWT_AUDIENCE },
      );
      const req = {
        cookies: { [CRM_AUTH_COOKIE]: token },
        headers: {},
        path: '/134/images',
        originalUrl: '/api/products/134/images',
      } as any;
      const authRes = responseStub();
      let authenticated = false;

      await authMiddleware(req, authRes as any, () => {
        authenticated = true;
      });
      assert.equal(authenticated, true);

      const accessRes = responseStub();
      let authorized = false;
      await managerAccess(req, accessRes as any, () => {
        authorized = true;
      });

      assert.equal(authorized, true);
      assert.equal(accessRes.statusCode, 200);
    });
  }

  it('keeps other authenticated roles forbidden', async () => {
    const req = { user: { id: 9, email: 'user@example.test', name: 'User', role: 'user' } } as any;
    const res = responseStub();
    let nextCalled = false;

    await managerAccess(req, res as any, () => {
      nextCalled = true;
    });

    assert.equal(nextCalled, false);
    assert.equal(res.statusCode, 403);
  });
});
