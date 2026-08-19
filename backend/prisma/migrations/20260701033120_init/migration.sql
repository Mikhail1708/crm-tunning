-- DropIndex
DROP INDEX "Product_article_key";

-- AlterTable
ALTER TABLE "SaleDocument" ADD COLUMN     "source" TEXT;

-- AddForeignKey
ALTER TABLE "Client" ADD CONSTRAINT "Client_discountUpdatedBy_fkey" FOREIGN KEY ("discountUpdatedBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "SaleDocument" ADD CONSTRAINT "SaleDocument_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PriceHistory" ADD CONSTRAINT "PriceHistory_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
