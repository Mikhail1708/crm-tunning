ALTER TABLE "SaleDocument"
ADD COLUMN "externalPaymentId" TEXT,
ADD COLUMN "paidAmountMinor" BIGINT,
ADD COLUMN "paymentCurrency" TEXT;

CREATE UNIQUE INDEX "SaleDocument_externalPaymentId_key"
ON "SaleDocument"("externalPaymentId");

ALTER TABLE "SaleDocument"
ADD CONSTRAINT "SaleDocument_external_payment_facts_check" CHECK (
  ("externalPaymentId" IS NULL AND "paidAmountMinor" IS NULL AND "paymentCurrency" IS NULL)
  OR
  ("externalPaymentId" IS NOT NULL AND "paidAmountMinor" IS NOT NULL
    AND "paidAmountMinor" >= 0 AND "paymentCurrency" = 'RUB')
);

CREATE TABLE "InventoryReservation" (
    "id" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "payloadHash" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'active',
    "currency" TEXT NOT NULL DEFAULT 'RUB',
    "totalMinor" BIGINT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "paymentId" TEXT,
    "paidAmountMinor" BIGINT,
    "saleDocumentId" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InventoryReservation_pkey" PRIMARY KEY ("id"),
    CONSTRAINT "InventoryReservation_status_check"
      CHECK ("status" IN ('active', 'consumed', 'released', 'expired')),
    CONSTRAINT "InventoryReservation_currency_check" CHECK ("currency" = 'RUB'),
    CONSTRAINT "InventoryReservation_total_minor_check" CHECK ("totalMinor" >= 0),
    CONSTRAINT "InventoryReservation_paid_amount_minor_check"
      CHECK ("paidAmountMinor" IS NULL OR "paidAmountMinor" >= 0),
    CONSTRAINT "InventoryReservation_terminal_facts_check" CHECK (
      ("status" = 'consumed' AND "paymentId" IS NOT NULL
        AND "paidAmountMinor" IS NOT NULL AND "saleDocumentId" IS NOT NULL)
      OR
      ("status" <> 'consumed' AND "paymentId" IS NULL
        AND "paidAmountMinor" IS NULL AND "saleDocumentId" IS NULL)
    )
);

CREATE TABLE "InventoryReservationItem" (
    "reservationId" TEXT NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "unitPriceMinor" BIGINT NOT NULL,
    "totalMinor" BIGINT NOT NULL,
    "productName" TEXT NOT NULL,
    "productArticle" TEXT NOT NULL,
    "costPrice" DOUBLE PRECISION NOT NULL,

    CONSTRAINT "InventoryReservationItem_pkey" PRIMARY KEY ("reservationId", "productId"),
    CONSTRAINT "InventoryReservationItem_quantity_check" CHECK ("quantity" > 0),
    CONSTRAINT "InventoryReservationItem_unit_price_minor_check" CHECK ("unitPriceMinor" >= 0),
    CONSTRAINT "InventoryReservationItem_total_minor_check"
      CHECK ("totalMinor" = "unitPriceMinor" * "quantity")
);

CREATE UNIQUE INDEX "InventoryReservation_externalOrderId_key"
ON "InventoryReservation"("externalOrderId");
CREATE UNIQUE INDEX "InventoryReservation_paymentId_key"
ON "InventoryReservation"("paymentId");
CREATE UNIQUE INDEX "InventoryReservation_saleDocumentId_key"
ON "InventoryReservation"("saleDocumentId");
CREATE INDEX "InventoryReservation_status_expiresAt_idx"
ON "InventoryReservation"("status", "expiresAt");
CREATE INDEX "InventoryReservationItem_productId_idx"
ON "InventoryReservationItem"("productId");

ALTER TABLE "InventoryReservation"
ADD CONSTRAINT "InventoryReservation_saleDocumentId_fkey"
FOREIGN KEY ("saleDocumentId") REFERENCES "SaleDocument"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "InventoryReservationItem"
ADD CONSTRAINT "InventoryReservationItem_reservationId_fkey"
FOREIGN KEY ("reservationId") REFERENCES "InventoryReservation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "InventoryReservationItem"
ADD CONSTRAINT "InventoryReservationItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
