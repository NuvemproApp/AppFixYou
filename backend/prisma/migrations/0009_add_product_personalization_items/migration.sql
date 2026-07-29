-- CreateTable
CREATE TABLE "product_personalization_items" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "personalizationItemId" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "product_personalization_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "product_personalization_items_storeId_productId_idx" ON "product_personalization_items"("storeId", "productId");

-- CreateIndex
CREATE UNIQUE INDEX "product_personalization_items_storeId_productId_personali_key" ON "product_personalization_items"("storeId", "productId", "personalizationItemId");

-- AddForeignKey
ALTER TABLE "product_personalization_items" ADD CONSTRAINT "product_personalization_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_personalization_items" ADD CONSTRAINT "product_personalization_items_personalizationItemId_fkey" FOREIGN KEY ("personalizationItemId") REFERENCES "personalization_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
