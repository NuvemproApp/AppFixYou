-- CreateTable
CREATE TABLE "personalization_items" (
    "id" SERIAL NOT NULL,
    "storeId" INTEGER NOT NULL,
    "categoria" TEXT NOT NULL,
    "titulo" TEXT NOT NULL,
    "valor" JSONB NOT NULL,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "posicao" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "personalization_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "personalization_items_storeId_categoria_posicao_idx" ON "personalization_items"("storeId", "categoria", "posicao");

-- AddForeignKey
ALTER TABLE "personalization_items" ADD CONSTRAINT "personalization_items_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "stores"("id") ON DELETE CASCADE ON UPDATE CASCADE;
