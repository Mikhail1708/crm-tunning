import assert from 'node:assert/strict';
import test from 'node:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { PrismaClient } from '@prisma/client';
const oldSql = readFileSync(resolve(__dirname, '../prisma/migrations/20260831103916_crm_cancellation_status_outbox/migration.sql'), 'utf8').replace(/\r\n/g, '\n');
const newSql = readFileSync(resolve(__dirname, '../prisma/migrations/20260924090000_crm_cancellation_requested_state/migration.sql'), 'utf8');
const oldCheck = oldSql.slice(oldSql.indexOf('ALTER TABLE "SaleDocument"\nADD CONSTRAINT'), oldSql.indexOf('CREATE TABLE "CrmStatusOutboxEvent"')).trim();
const newCheck = newSql.slice(newSql.indexOf('ALTER TABLE'), newSql.indexOf('COMMIT;')).trim();
test('migration extends original CHECK explicitly for undecided requested state', () => {
  const expression = oldCheck.slice(oldCheck.indexOf('CHECK (') + 7, oldCheck.lastIndexOf(');')).trim();
  assert.ok(newCheck.slice(newCheck.indexOf('CHECK (') + 7).trim().startsWith(expression));
  assert.match(newCheck, /"cancellationReasonCode" = 'CUSTOMER_CANCELLATION_REQUESTED'/);
  assert.match(newSql, /BEGIN;[\s\S]+COMMIT;/);
});
const testUrl = process.env.CRM_CANCELLATION_TEST_DATABASE_URL;
test('PostgreSQL old CHECK rejects pending tuple; new CHECK accepts pending and manager decisions', {
  skip: !testUrl && 'requires explicit disposable local CRM_CANCELLATION_TEST_DATABASE_URL',
}, async () => {
  const url = new URL(testUrl!);
  assert.ok(['localhost', '127.0.0.1', '[::1]'].includes(url.hostname));
  assert.match(url.pathname, /test/i);
  const prisma = new PrismaClient({ datasources: { db: { url: testUrl } } });
  try {
    await prisma.$transaction(async tx => {
      await tx.$executeRawUnsafe(`CREATE TEMP TABLE "SaleDocument" (
        "cancellationRequestId" TEXT, "cancellationDecision" TEXT, "cancellationReasonCode" TEXT,
        "cancellationReason" TEXT, "cancellationRequestedAt" TIMESTAMP, "cancellationDecidedAt" TIMESTAMP
      ) ON COMMIT DROP`);
      await tx.$executeRawUnsafe(oldCheck);
      const pending = `INSERT INTO "SaleDocument" VALUES ('crm-order-cancellation:379', NULL, 'CUSTOMER_CANCELLATION_REQUESTED', 'customer_request', CURRENT_TIMESTAMP, NULL)`;
      const rejectsCheck = async (sql: string) => {
        await tx.$executeRawUnsafe('SAVEPOINT constraint_case');
        await assert.rejects(tx.$executeRawUnsafe(sql), (e: any) => e.meta?.code === '23514');
        await tx.$executeRawUnsafe('ROLLBACK TO SAVEPOINT constraint_case');
        await tx.$executeRawUnsafe('RELEASE SAVEPOINT constraint_case');
      };
      await rejectsCheck(pending);
      await tx.$executeRawUnsafe(newCheck);
      await tx.$executeRawUnsafe(pending);
      await tx.$executeRawUnsafe('INSERT INTO "SaleDocument" DEFAULT VALUES');
      for (const decision of ['accepted', 'rejected']) {
        await tx.$executeRaw`INSERT INTO "SaleDocument" VALUES (${decision}, ${decision}, 'MANAGER_DECISION', NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`;
      }
      await rejectsCheck(`INSERT INTO "SaleDocument" VALUES ('bad', 'requested', 'CUSTOMER_CANCELLATION_REQUESTED', NULL, CURRENT_TIMESTAMP, NULL)`);
      await rejectsCheck(`INSERT INTO "SaleDocument" VALUES ('bad', NULL, 'WRONG_REASON', NULL, CURRENT_TIMESTAMP, NULL)`);
      await rejectsCheck(`INSERT INTO "SaleDocument" VALUES ('bad', NULL, 'CUSTOMER_CANCELLATION_REQUESTED', NULL, NULL, NULL)`);
      const rows = await tx.$queryRaw<Array<{ count: bigint }>>`SELECT COUNT(*) AS count FROM "SaleDocument"`;
      assert.equal(rows[0].count, 4n);
    });
  } finally { await prisma.$disconnect(); }
});
