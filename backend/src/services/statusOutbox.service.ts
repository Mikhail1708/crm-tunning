import { Prisma, PrismaClient } from '@prisma/client';
import {
  crmStatusEventId,
  statusOutboxRetryDelayMs,
  STATUS_OUTBOX_MAX_ATTEMPTS,
  STATUS_OUTBOX_RETENTION_MS,
  STATUS_OUTBOX_CLEANUP_BATCH_SIZE,
  STATUS_OUTBOX_CLEANUP_INTERVAL_MS,
} from '../domain/statusOutbox';
import { deliverOrderStatusWebhook, OrderStatusWebhookPayload } from './webhook.service';

// Shared by the new lifecycle/outbox components so this patch adds only one
// Prisma pool while the repository-wide client consolidation remains separate.
export const lifecyclePrisma = new PrismaClient();

type StatusProjectionDocument = {
  id: number;
  externalOrderId: string | null;
  documentNumber: string;
  orderStatus: string;
  statusVersion: number;
};

type ClaimedOutboxEvent = {
  id: string;
  payload: Prisma.JsonValue;
  attempts: number;
};

const configuredInteger = (value: string | undefined, fallback: number, minimum: number): number => {
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed >= minimum ? parsed : fallback;
};

const pollIntervalMs = (): number => configuredInteger(
  process.env.CRM_STATUS_OUTBOX_POLL_MS,
  1_000,
  250,
);

const staleAfterMs = (): number => configuredInteger(
  process.env.CRM_STATUS_OUTBOX_STALE_MS,
  60_000,
  10_000,
);

export const buildOrderStatusWebhookPayload = (
  document: StatusProjectionDocument,
  timestamp = new Date(),
): OrderStatusWebhookPayload => {
  const eventId = crmStatusEventId(document.id, document.statusVersion);
  return {
    eventId,
    crmOrderId: document.id,
    externalOrderId: document.externalOrderId,
    documentNumber: document.documentNumber,
    status: document.orderStatus,
    version: document.statusVersion,
    timestamp: timestamp.toISOString(),
  };
};

export const enqueueOrderStatusProjection = async (
  tx: Prisma.TransactionClient,
  document: StatusProjectionDocument,
): Promise<void> => {
  const payload = buildOrderStatusWebhookPayload(document);
  await (tx as any).crmStatusOutboxEvent.upsert({
    where: { id: payload.eventId },
    create: {
      id: payload.eventId,
      saleDocumentId: document.id,
      statusVersion: document.statusVersion,
      payload,
    },
    // The payload is immutable. A duplicate enqueue is an idempotent no-op.
    update: {},
  });
};

const claimNextStatusEvent = async (): Promise<ClaimedOutboxEvent | null> => {
  const staleBefore = new Date(Date.now() - staleAfterMs());
  return lifecyclePrisma.$transaction(async tx => {
    await tx.$executeRaw`
      UPDATE "CrmStatusOutboxEvent"
      SET "deliveryStatus" = 'pending',
          "lockedAt" = NULL,
          "nextAttemptAt" = CURRENT_TIMESTAMP,
          "updatedAt" = CURRENT_TIMESTAMP,
          "lastError" = COALESCE("lastError", 'Recovered stale delivery claim')
      WHERE "deliveryStatus" = 'processing'
        AND "lockedAt" < ${staleBefore}
    `;

    const candidates = await tx.$queryRaw<ClaimedOutboxEvent[]>`
      SELECT "id", "payload", "attempts"
      FROM "CrmStatusOutboxEvent"
      WHERE "deliveryStatus" = 'pending'
        AND "attempts" < ${STATUS_OUTBOX_MAX_ATTEMPTS}
        AND "nextAttemptAt" <= CURRENT_TIMESTAMP
      ORDER BY "nextAttemptAt" ASC, "createdAt" ASC
      FOR UPDATE SKIP LOCKED
      LIMIT 1
    `;
    const candidate = candidates[0];
    if (!candidate) return null;

    const claimed = await (tx as any).crmStatusOutboxEvent.updateMany({
      where: { id: candidate.id, deliveryStatus: 'pending', attempts: { lt: STATUS_OUTBOX_MAX_ATTEMPTS } },
      data: {
        deliveryStatus: 'processing',
        attempts: { increment: 1 },
        lockedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    if (claimed.count !== 1) return null;
    return { ...candidate, attempts: candidate.attempts + 1 };
  }, { isolationLevel: Prisma.TransactionIsolationLevel.ReadCommitted, timeout: 10_000 });
};

const markDelivered = async (event: ClaimedOutboxEvent): Promise<void> => {
  await (lifecyclePrisma as any).crmStatusOutboxEvent.updateMany({
    // Fence an expired worker: it must not finalize a newer delivery claim.
    where: { id: event.id, deliveryStatus: 'processing', attempts: event.attempts },
    data: {
      deliveryStatus: 'delivered',
      deliveredAt: new Date(),
      lockedAt: null,
      lastError: null,
      updatedAt: new Date(),
    },
  });
};

const reschedule = async (event: ClaimedOutboxEvent, error: string): Promise<void> => {
  await (lifecyclePrisma as any).crmStatusOutboxEvent.updateMany({
    where: { id: event.id, deliveryStatus: 'processing', attempts: event.attempts },
    data: {
      // pending + attempts >= MAX is retained but never automatically claimed.
      // Keep payload/error for diagnosis; do not pretend it was delivered.
      deliveryStatus: 'pending',
      lockedAt: null,
      lastError: error.slice(0, 4_000),
      nextAttemptAt: new Date(Date.now() + statusOutboxRetryDelayMs(event.attempts)),
      updatedAt: new Date(),
    },
  });
};

export const dispatchNextOrderStatusProjection = async (): Promise<boolean> => {
  const event = await claimNextStatusEvent();
  if (!event) return false;

  try {
    await deliverOrderStatusWebhook(event.payload as unknown as OrderStatusWebhookPayload);
    await markDelivered(event);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unknown webhook delivery failure';
    console.error(`CRM status outbox delivery failed for ${event.id}: ${message}`);
    await reschedule(event, message);
  }
  return true;
};

let dispatcherTimer: NodeJS.Timeout | null = null;
let dispatcherRunning = false;
let nextCleanupAt = 0;

export const cleanupDeliveredStatusEvents = async (): Promise<number> => {
  const cutoff = new Date(Date.now() - STATUS_OUTBOX_RETENTION_MS);
  // One atomic bounded batch, no IDs/table materialized in Node. Skip rows held
  // by another worker and never remove undelivered (including exhausted) events.
  return lifecyclePrisma.$executeRaw`
    WITH expired AS (
      SELECT "id" FROM "CrmStatusOutboxEvent"
      WHERE "deliveryStatus" = 'delivered' AND "deliveredAt" < ${cutoff}
        AND "lockedAt" IS NULL
      ORDER BY "deliveredAt", "id"
      FOR UPDATE SKIP LOCKED
      LIMIT ${STATUS_OUTBOX_CLEANUP_BATCH_SIZE}
    )
    DELETE FROM "CrmStatusOutboxEvent" event USING expired
    WHERE event."id" = expired."id"
  `;
};

export const drainAvailableEvents = async (): Promise<void> => {
  if (dispatcherRunning) return;
  dispatcherRunning = true;
  try {
    for (let processed = 0; processed < 25; processed += 1) {
      if (!(await dispatchNextOrderStatusProjection())) break;
    }
    if (Date.now() >= nextCleanupAt) {
      nextCleanupAt = Date.now() + STATUS_OUTBOX_CLEANUP_INTERVAL_MS;
      try { await cleanupDeliveredStatusEvents(); }
      catch { console.error('CRM status outbox retention cleanup failed'); }
    }
  } finally {
    dispatcherRunning = false;
  }
};

export const startOrderStatusOutboxDispatcher = (): void => {
  if (dispatcherTimer) return;
  void drainAvailableEvents().catch(error => {
    console.error('CRM status outbox initial dispatch failed:', error);
  });
  dispatcherTimer = setInterval(() => {
    void drainAvailableEvents().catch(error => {
      console.error('CRM status outbox dispatch failed:', error);
    });
  }, pollIntervalMs());
  dispatcherTimer.unref();
};
