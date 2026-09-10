-- Do not apply until existing stock and sale quantities have been checked.
-- No rows are changed or deleted. Invalid existing data makes these CHECKs fail.
ALTER TABLE "Product"
  ADD CONSTRAINT "Product_stock_nonnegative_check" CHECK ("stock" >= 0);

ALTER TABLE "Sale"
  ADD CONSTRAINT "Sale_quantity_positive_check" CHECK ("quantity" > 0);

ALTER TABLE "SaleDocumentItem"
  ADD CONSTRAINT "SaleDocumentItem_quantity_positive_check" CHECK ("quantity" > 0);

-- Replace only historical product foreign keys; technical children retain Cascade.
ALTER TABLE "Sale"
  DROP CONSTRAINT "Sale_productId_fkey",
  ADD CONSTRAINT "Sale_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "SaleDocumentItem"
  DROP CONSTRAINT "SaleDocumentItem_productId_fkey",
  ADD CONSTRAINT "SaleDocumentItem_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "PriceHistory"
  DROP CONSTRAINT "PriceHistory_productId_fkey",
  ADD CONSTRAINT "PriceHistory_productId_fkey" FOREIGN KEY ("productId")
    REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
