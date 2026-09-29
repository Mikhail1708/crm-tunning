ALTER TABLE "InvoiceAllocation"
  ADD COLUMN "confirmationId" TEXT,
  ADD COLUMN "confirmedAt" TIMESTAMP(3),
  ADD COLUMN "confirmedById" INTEGER,
  ADD COLUMN "confirmedByName" TEXT;
CREATE UNIQUE INDEX "InvoiceAllocation_confirmationId_key" ON "InvoiceAllocation"("confirmationId");
ALTER TABLE "InvoiceAllocation" ADD CONSTRAINT "InvoiceAllocation_confirmation_complete_check" CHECK (
  ("confirmationId" IS NULL AND "confirmedAt" IS NULL AND "confirmedById" IS NULL AND "confirmedByName" IS NULL)
  OR ("confirmationId" IS NOT NULL AND "confirmedAt" IS NOT NULL AND "confirmedById" IS NOT NULL AND "confirmedByName" IS NOT NULL AND "status" = 'committed')
);
