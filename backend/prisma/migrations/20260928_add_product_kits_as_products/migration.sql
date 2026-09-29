ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "isKit" BOOLEAN NOT NULL DEFAULT false;
CREATE TABLE IF NOT EXISTS "ProductKit" ("id" SERIAL NOT NULL,"productId" INTEGER,"createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,"updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,CONSTRAINT "ProductKit_pkey" PRIMARY KEY ("id"));
ALTER TABLE "ProductKit" ADD COLUMN IF NOT EXISTS "productId" INTEGER;
DO $$ DECLARE r RECORD; new_product_id INTEGER; BEGIN
 IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ProductKit' AND column_name='name') THEN
  FOR r IN SELECT "id","name","description" FROM "ProductKit" WHERE "productId" IS NULL LOOP
   INSERT INTO "Product" ("name","article","cost_price","retail_price","stock","min_stock","description","isPublished","isKit","costBreakdown","createdAt","updatedAt") VALUES (r."name",'KIT-'||r."id",0,0,0,0,r."description",true,true,'[]'::jsonb,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP) RETURNING "id" INTO new_product_id;
   UPDATE "ProductKit" SET "productId"=new_product_id WHERE "id"=r."id";
  END LOOP;
 END IF;
END $$;
ALTER TABLE "ProductKit" DROP COLUMN IF EXISTS "name"; ALTER TABLE "ProductKit" DROP COLUMN IF EXISTS "description"; ALTER TABLE "ProductKit" ALTER COLUMN "productId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductKit_productId_key" ON "ProductKit"("productId");
CREATE TABLE IF NOT EXISTS "ProductKitItem" ("id" SERIAL NOT NULL,"kitId" INTEGER NOT NULL,"componentProductId" INTEGER,"quantity" INTEGER NOT NULL DEFAULT 1,"sortOrder" INTEGER NOT NULL DEFAULT 0,CONSTRAINT "ProductKitItem_pkey" PRIMARY KEY ("id"));
ALTER TABLE "ProductKitItem" ADD COLUMN IF NOT EXISTS "componentProductId" INTEGER;
DO $$ BEGIN IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name='ProductKitItem' AND column_name='productId') THEN UPDATE "ProductKitItem" SET "componentProductId"="productId" WHERE "componentProductId" IS NULL; ALTER TABLE "ProductKitItem" DROP CONSTRAINT IF EXISTS "ProductKitItem_productId_fkey"; ALTER TABLE "ProductKitItem" DROP COLUMN "productId"; END IF; END $$;
ALTER TABLE "ProductKitItem" ALTER COLUMN "componentProductId" SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "ProductKitItem_kitId_componentProductId_key" ON "ProductKitItem"("kitId","componentProductId"); CREATE INDEX IF NOT EXISTS "ProductKitItem_kitId_idx" ON "ProductKitItem"("kitId"); CREATE INDEX IF NOT EXISTS "ProductKitItem_componentProductId_idx" ON "ProductKitItem"("componentProductId");
DO $$ BEGIN ALTER TABLE "ProductKit" ADD CONSTRAINT "ProductKit_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductKitItem" ADD CONSTRAINT "ProductKitItem_kitId_fkey" FOREIGN KEY ("kitId") REFERENCES "ProductKit"("id") ON DELETE CASCADE ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN ALTER TABLE "ProductKitItem" ADD CONSTRAINT "ProductKitItem_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "Product"("id") ON DELETE RESTRICT ON UPDATE CASCADE; EXCEPTION WHEN duplicate_object THEN NULL; END $$;
