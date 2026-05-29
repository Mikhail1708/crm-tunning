-- AlterTable
ALTER TABLE "Client" ADD COLUMN     "discountPercent" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "discountUpdatedAt" TIMESTAMP(3),
ADD COLUMN     "discountUpdatedBy" INTEGER;
