ALTER TABLE "SaleDocument"
ADD COLUMN "cancellationRequestId" TEXT,
ADD COLUMN "cancellationDecision" TEXT,
ADD COLUMN "cancellationReasonCode" TEXT,
ADD COLUMN "cancellationReason" TEXT,
ADD COLUMN "cancellationRequestedAt" TIMESTAMP(3),
ADD COLUMN "cancellationDecidedAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "SaleDocument_cancellationRequestId_key"
ON "SaleDocument"("cancellationRequestId");

ALTER TABLE "SaleDocument"
ADD CONSTRAINT "SaleDocument_cancellation_decision_check" CHECK (
  (
    "cancellationRequestId" IS NULL
    AND "cancellationDecision" IS NULL
    AND "cancellationReasonCode" IS NULL
    AND "cancellationReason" IS NULL
    AND "cancellationRequestedAt" IS NULL
    AND "cancellationDecidedAt" IS NULL
  )
  OR
  (
    "cancellationRequestId" IS NOT NULL
    AND "cancellationDecision" IN ('accepted', 'rejected')
    AND "cancellationReasonCode" IS NOT NULL
    AND "cancellationRequestedAt" IS NOT NULL
    AND "cancellationDecidedAt" IS NOT NULL
  )
);

CREATE TABLE "CrmStatusOutboxEvent" (
  "id" TEXT NOT NULL,
  "saleDocumentId" INTEGER NOT NULL,
  "statusVersion" INTEGER NOT NULL,
  "payload" JSONB NOT NULL,
  "deliveryStatus" TEXT NOT NULL DEFAULT 'pending',
  "attempts" INTEGER NOT NULL DEFAULT 0,
  "nextAttemptAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lockedAt" TIMESTAMP(3),
  "lastError" TEXT,
  "deliveredAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "CrmStatusOutboxEvent_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "CrmStatusOutboxEvent_status_version_check" CHECK ("statusVersion" >= 0),
  CONSTRAINT "CrmStatusOutboxEvent_attempts_check" CHECK ("attempts" >= 0),
  CONSTRAINT "CrmStatusOutboxEvent_delivery_status_check"
    CHECK ("deliveryStatus" IN ('pending', 'processing', 'delivered')),
  CONSTRAINT "CrmStatusOutboxEvent_delivery_state_check" CHECK (
    ("deliveryStatus" = 'delivered' AND "deliveredAt" IS NOT NULL AND "lockedAt" IS NULL)
    OR
    ("deliveryStatus" <> 'delivered' AND "deliveredAt" IS NULL)
  )
);

CREATE UNIQUE INDEX "CrmStatusOutboxEvent_saleDocumentId_statusVersion_key"
ON "CrmStatusOutboxEvent"("saleDocumentId", "statusVersion");

CREATE INDEX "CrmStatusOutboxEvent_deliveryStatus_nextAttemptAt_idx"
ON "CrmStatusOutboxEvent"("deliveryStatus", "nextAttemptAt");

CREATE INDEX "CrmStatusOutboxEvent_deliveryStatus_lockedAt_idx"
ON "CrmStatusOutboxEvent"("deliveryStatus", "lockedAt");

ALTER TABLE "CrmStatusOutboxEvent"
ADD CONSTRAINT "CrmStatusOutboxEvent_saleDocumentId_fkey"
FOREIGN KEY ("saleDocumentId") REFERENCES "SaleDocument"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed one durable projection for every existing website order. The unique
-- document/version key makes this safe and lets the website's version CAS
-- treat already-applied projections as idempotent.
INSERT INTO "CrmStatusOutboxEvent" (
  "id",
  "saleDocumentId",
  "statusVersion",
  "payload",
  "deliveryStatus",
  "attempts",
  "nextAttemptAt",
  "createdAt",
  "updatedAt"
)
SELECT
  'crm-order-status:' || "id"::text || ':v' || "statusVersion"::text,
  "id",
  "statusVersion",
  jsonb_build_object(
    'eventId', 'crm-order-status:' || "id"::text || ':v' || "statusVersion"::text,
    'crmOrderId', "id",
    'externalOrderId', "externalOrderId",
    'documentNumber', "documentNumber",
    'status', "orderStatus",
    'version', "statusVersion",
    'timestamp', CURRENT_TIMESTAMP
  ),
  'pending',
  0,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "SaleDocument"
WHERE "source" = 'website';
