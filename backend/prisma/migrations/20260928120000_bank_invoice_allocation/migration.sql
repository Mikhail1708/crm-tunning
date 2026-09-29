CREATE TABLE "InvoiceAllocation" (
 "id" TEXT PRIMARY KEY, "externalOrderId" TEXT NOT NULL UNIQUE,
 "invoiceId" TEXT NOT NULL UNIQUE, "invoiceNumber" TEXT UNIQUE,
 "requestId" TEXT UNIQUE, "payloadHash" TEXT, "payload" JSONB,
 "amountMinor" BIGINT, "currency" TEXT NOT NULL DEFAULT 'RUB', "dueAt" TIMESTAMP(3),
 "status" TEXT NOT NULL DEFAULT 'held', "saleDocumentId" INTEGER UNIQUE,
 "releaseRequestId" TEXT UNIQUE, "releaseReason" TEXT, "releasedAt" TIMESTAMP(3),
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP, "updatedAt" TIMESTAMP(3) NOT NULL,
 CONSTRAINT "InvoiceAllocation_saleDocumentId_fkey" FOREIGN KEY ("saleDocumentId") REFERENCES "SaleDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
 CONSTRAINT "InvoiceAllocation_state_check" CHECK ("status" IN ('held','committed','released')),
 CONSTRAINT "InvoiceAllocation_amount_check" CHECK ("amountMinor" IS NULL OR "amountMinor" > 0),
 CONSTRAINT "InvoiceAllocation_currency_check" CHECK ("currency" = 'RUB'),
 CONSTRAINT "InvoiceAllocation_held_check" CHECK ("status" = 'released' OR ("saleDocumentId" IS NOT NULL AND "payloadHash" IS NOT NULL AND "payload" IS NOT NULL AND "dueAt" IS NOT NULL AND "amountMinor" IS NOT NULL))
);
CREATE INDEX "InvoiceAllocation_status_dueAt_idx" ON "InvoiceAllocation"("status", "dueAt");
