-- CreateTable
CREATE TABLE "personalization_captures" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "productId" TEXT NOT NULL,
    "customerId" TEXT,
    "texto" TEXT NOT NULL,
    "props" JSONB NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "orderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "matchedAt" TIMESTAMP(3),

    CONSTRAINT "personalization_captures_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personalization_captures_lookup_idx" ON "personalization_captures"("storeId", "productId", "status", "createdAt");

-- CreateIndex
CREATE INDEX "personalization_captures_order_idx" ON "personalization_captures"("storeId", "orderId");

-- AddForeignKey
ALTER TABLE "personalization_captures" ADD CONSTRAINT "personalization_captures_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
