/*
  Warnings:

  - You are about to drop the column `tax` on the `SaleDocument` table. All the data in the column will be lost.

*/
-- AlterTable
ALTER TABLE "SaleDocument" DROP COLUMN "tax",
ADD COLUMN     "createdBy" INTEGER;
