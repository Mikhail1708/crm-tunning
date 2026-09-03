-- Phase 1 keeps legacy filesystem metadata nullable until the explicit import script
-- has copied every existing image into PostgreSQL. This migration does not read,
-- modify, or delete files from backend/uploads/products.
ALTER TABLE "ProductImage"
  ALTER COLUMN "url" DROP NOT NULL,
  ALTER COLUMN "filename" DROP NOT NULL,
  ADD COLUMN "data" BYTEA,
  ADD COLUMN "mimeType" TEXT,
  ADD COLUMN "width" INTEGER,
  ADD COLUMN "height" INTEGER,
  ADD COLUMN "originalName" TEXT,
  ADD COLUMN "contentHash" TEXT,
  ADD COLUMN "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;
