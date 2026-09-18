import test from 'node:test';
import assert from 'node:assert/strict';
import * as webhook from '../src/services/webhook.service';
import { lifecyclePrisma, dispatchNextOrderStatusProjection, cleanupDeliveredStatusEvents, drainAvailableEvents } from '../src/services/statusOutbox.service';
import { STATUS_OUTBOX_MAX_ATTEMPTS as MAX, STATUS_OUTBOX_RETENTION_MS as RETENTION, STATUS_OUTBOX_CLEANUP_BATCH_SIZE as BATCH } from '../src/domain/statusOutbox';

type Row = { id: string; payload: any; attempts: number; deliveryStatus: string; lockedAt: Date | null; deliveredAt: Date | null; nextAttemptAt: Date; lastError?: string };
function row(overrides: Partial<Row> = {}): Row {
  return { id: 'event', payload: { eventId: 'event' }, attempts: 0, deliveryStatus: 'pending', lockedAt: null, deliveredAt: null, nextAttemptAt: new Date(0), ...overrides };
}
function fixture(rows: Row[]) {
  const db = lifecyclePrisma as any;
  const original = { transaction: db.$transaction, execute: db.$executeRaw, update: db.crmStatusOutboxEvent.updateMany, send: webhook.deliverOrderStatusWebhook };
  let sends = 0, cleanups = 0;
  let failCleanup = false;
  let send: () => Promise<void> = async () => { throw new Error('fixture delivery failure'); };
  const update = async ({ where, data }: any) => {
    const r = rows.find(r => r.id === where.id && r.deliveryStatus === where.deliveryStatus &&
      (typeof where.attempts === 'number' ? r.attempts === where.attempts : r.attempts < where.attempts.lt));
    if (!r) return { count: 0 };
    const attempts = data.attempts ? r.attempts + data.attempts.increment : r.attempts;
    Object.assign(r, data, { attempts }); return { count: 1 };
  };
  db.crmStatusOutboxEvent.updateMany = update;
  db.$transaction = async (callback: any) => callback({
    $executeRaw: async (strings: TemplateStringsArray, staleBefore: Date) => {
      assert.match(strings.join('?'), /lockedAt.*</s);
      for (const r of rows) if (r.deliveryStatus === 'processing' && r.lockedAt! < staleBefore) {
        r.deliveryStatus = 'pending'; r.lockedAt = null; r.nextAttemptAt = new Date(0);
      }
    },
    $queryRaw: async (strings: TemplateStringsArray, cap: number) => {
      const sql = strings.join('?');
      // These assertions fail on the old unbounded retry selection.
      assert.match(sql, /"attempts" < \?/); assert.match(sql, /FOR UPDATE SKIP LOCKED/); assert.equal(cap, MAX);
      const r = rows.find(r => r.deliveryStatus === 'pending' && r.attempts < cap && r.nextAttemptAt.getTime() <= Date.now());
      return r ? [{ id: r.id, payload: r.payload, attempts: r.attempts }] : [];
    }, crmStatusOutboxEvent: { updateMany: update },
  });
  db.$executeRaw = async (strings: TemplateStringsArray, cutoff: Date, batch: number) => {
    cleanups++;
    const sql = strings.join('?');
    assert.match(sql, /"deliveryStatus" = 'delivered'/); assert.match(sql, /"deliveredAt" < \?/);
    assert.match(sql, /"lockedAt" IS NULL/); assert.match(sql, /FOR UPDATE SKIP LOCKED/);
    assert.match(sql, /LIMIT \?/); assert.match(sql, /DELETE FROM/); assert.equal(batch, BATCH);
    assert.ok(Math.abs(Date.now() - cutoff.getTime() - RETENTION) < 2000);
    if (failCleanup) throw new Error('fixture cleanup failure');
    const expired = rows.filter(r => r.deliveryStatus === 'delivered' && r.deliveredAt! < cutoff && r.lockedAt === null).slice(0, batch);
    for (const r of expired) rows.splice(rows.indexOf(r), 1);
    return expired.length;
  };
  (webhook as any).deliverOrderStatusWebhook = async () => { sends++; await send(); };
  return { rows, get sends() { return sends; }, get cleanups() { return cleanups; },
    onSend(fn: () => Promise<void>) { send = fn; }, cleanupFails() { failCleanup = true; },
    restore() { db.$transaction = original.transaction; db.$executeRaw = original.execute; db.crmStatusOutboxEvent.updateMany = original.update; (webhook as any).deliverOrderStatusWebhook = original.send; } };
}

test('ordinary retry schedules backoff and does not send before due time', async () => {
  const r = row(), f = fixture([r]);
  try { const before = Date.now(); await dispatchNextOrderStatusProjection();
    assert.equal(r.attempts, 1); assert.equal(r.deliveryStatus, 'pending'); assert.equal(r.lockedAt, null);
    assert.ok(r.nextAttemptAt.getTime() >= before + 1000); assert.equal(await dispatchNextOrderStatusProjection(), false);
    assert.equal(f.sends, 1); assert.equal(r.lastError, 'fixture delivery failure');
  } finally { f.restore(); }
});

test('exactly MAX claims can send; exhausted event survives and cannot be selected again', async () => {
  const r = row(), f = fixture([r]);
  try {
    for (let i = 1; i <= MAX; i++) { r.nextAttemptAt = new Date(0); assert.equal(await dispatchNextOrderStatusProjection(), true); assert.equal(r.attempts, i); }
    r.nextAttemptAt = new Date(0);
    for (let i = 0; i < 3; i++) assert.equal(await dispatchNextOrderStatusProjection(), false);
    assert.equal(f.sends, MAX); assert.equal(r.deliveryStatus, 'pending'); assert.equal(r.lockedAt, null); assert.ok(r.lastError); assert.equal(f.rows.length, 1);
  } finally { f.restore(); }
});

test('last allowed attempt may succeed', async () => {
  const r = row({ attempts: MAX - 1 }), f = fixture([r]); f.onSend(async () => {});
  try { await dispatchNextOrderStatusProjection(); assert.equal(r.attempts, MAX); assert.equal(r.deliveryStatus, 'delivered'); assert.ok(r.deliveredAt); assert.equal(await dispatchNextOrderStatusProjection(), false); }
  finally { f.restore(); }
});

for (const attempts of [MAX - 1, MAX, MAX + 5]) test(`restart recovers stale claim with attempts=${attempts} without resetting budget`, async () => {
  const r = row({ attempts, deliveryStatus: 'processing', lockedAt: new Date(0) }), f = fixture([r]);
  try { assert.equal(await dispatchNextOrderStatusProjection(), attempts < MAX); assert.equal(f.sends, attempts < MAX ? 1 : 0); assert.equal(r.attempts, Math.min(attempts + 1, Math.max(attempts, MAX))); assert.equal(r.lockedAt, null); }
  finally { f.restore(); }
});

test('live processing claim is not selected', async () => {
  const r = row({ deliveryStatus: 'processing', lockedAt: new Date() }), f = fixture([r]);
  try { assert.equal(await dispatchNextOrderStatusProjection(), false); assert.equal(f.sends, 0); }
  finally { f.restore(); }
});

for (const fails of [false, true]) test(`late worker cannot finalize a newer claim (failure=${fails})`, async () => {
  const r = row(), f = fixture([r]);
  f.onSend(async () => { r.attempts++; r.lockedAt = new Date(); if (fails) throw new Error('old claim failure'); });
  try { await dispatchNextOrderStatusProjection(); assert.equal(r.deliveryStatus, 'processing'); assert.equal(r.attempts, 2); assert.equal(r.deliveredAt, null); assert.equal(r.lastError, undefined); }
  finally { f.restore(); }
});

test('bounded retention removes only old completed deliveries', async () => {
  const old = new Date(Date.now() - RETENTION - 10000);
  const retained = [row({ id: 'fresh', deliveryStatus: 'delivered', deliveredAt: new Date() }), row({ id: 'pending' }), row({ id: 'processing', deliveryStatus: 'processing', lockedAt: new Date() }), row({ id: 'terminal', attempts: MAX })];
  const f = fixture([...Array.from({ length: BATCH + 1 }, (_, i) => row({ id: `old-${i}`, deliveryStatus: 'delivered', deliveredAt: old })), ...retained]);
  try { assert.equal(await cleanupDeliveredStatusEvents(), BATCH); assert.equal(f.rows.length, retained.length + 1); assert.ok(retained.every(r => f.rows.includes(r))); assert.equal(await cleanupDeliveredStatusEvents(), 1); assert.deepEqual(f.rows, retained); }
  finally { f.restore(); }
});

test('worker ticks do not overlap; cleanup failure is isolated and throttled', async () => {
  const r = row(), f = fixture([r]); f.cleanupFails();
  let release!: () => void; const gate = new Promise<void>(resolve => { release = resolve; });
  f.onSend(async () => { await gate; });
  try { const first = drainAvailableEvents(); await drainAvailableEvents(); release(); await first;
    assert.equal(f.sends, 1); assert.equal(r.deliveryStatus, 'delivered'); assert.equal(f.cleanups, 1);
    await drainAvailableEvents(); assert.equal(f.cleanups, 1);
  } finally { release(); f.restore(); }
});
