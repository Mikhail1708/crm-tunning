ALTER TABLE "SaleDocument"
ADD COLUMN "externalOrderId" TEXT,
ADD COLUMN "externalPayloadHash" TEXT,
ADD COLUMN "statusVersion" INTEGER NOT NULL DEFAULT 0;

CREATE UNIQUE INDEX "SaleDocument_externalOrderId_key"
ON "SaleDocument"("externalOrderId");
