-- Pending customer requests are not manager decisions. Preserve the original
-- absent/decided cases and admit the application's existing requested tuple.
BEGIN;

ALTER TABLE "SaleDocument"
DROP CONSTRAINT "SaleDocument_cancellation_decision_check",
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
  OR
  (
    "cancellationRequestId" IS NOT NULL
    AND "cancellationDecision" IS NULL
    AND "cancellationReasonCode" IS NOT NULL
    AND "cancellationReasonCode" = 'CUSTOMER_CANCELLATION_REQUESTED'
    AND "cancellationRequestedAt" IS NOT NULL
    AND "cancellationDecidedAt" IS NULL
  )
);

COMMIT;
