CREATE TABLE "ProductKit" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "ProductKit_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "ProductKitItem" (
    "id" SERIAL NOT NULL,
    "kitId" INTEGER NOT NULL,
    "productId" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT "ProductKitItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "ProductKitItem_kitId_productId_key" ON "ProductKitItem"("kitId", "productId");
CREATE INDEX "ProductKitItem_kitId_idx" ON "ProductKitItem"("kitId");
CREATE INDEX "ProductKitItem_productId_idx" ON "ProductKitItem"("productId");

ALTER TABLE "ProductKitItem" ADD CONSTRAINT "ProductKitItem_kitId_fkey"
FOREIGN KEY ("kitId") REFERENCES "ProductKit"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "ProductKitItem" ADD CONSTRAINT "ProductKitItem_productId_fkey"
FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
