-- Keep the CRM workflow to the four statuses exposed to managers.
UPDATE "SaleDocument" SET "orderStatus" = 'confirmed' WHERE "orderStatus" = 'ordered';
UPDATE "SaleDocument" SET "orderStatus" = 'shipped' WHERE "orderStatus" = 'delivered';
ALTER TABLE "SaleDocument" ALTER COLUMN "orderStatus" SET DEFAULT 'confirmed';
