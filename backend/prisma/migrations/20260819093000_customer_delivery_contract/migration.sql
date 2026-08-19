ALTER TABLE "Client"
  ADD COLUMN "preferredContact" TEXT;

ALTER TABLE "SaleDocument"
  ADD COLUMN "contactMethod" TEXT,
  ADD COLUMN "deliveryMethod" TEXT,
  ADD COLUMN "deliveryProvider" TEXT;
