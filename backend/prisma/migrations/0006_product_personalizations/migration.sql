-- CreateTable: associação produto → modelo de personalização (FixYou)
CREATE TABLE "product_personalizations" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "modelo" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "product_personalizations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "product_personalizations_storeId_productId_key" ON "product_personalizations"("storeId", "productId");

-- AddForeignKey
ALTER TABLE "product_personalizations" ADD CONSTRAINT "product_personalizations_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
