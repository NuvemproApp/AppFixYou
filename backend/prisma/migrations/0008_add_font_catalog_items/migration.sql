-- CreateTable
CREATE TABLE "font_catalog_items" (
    "id" SERIAL NOT NULL,
    "family" TEXT NOT NULL,
    "ttfKey" TEXT NOT NULL,
    "webfontKey" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "font_catalog_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "font_catalog_items_family_key" ON "font_catalog_items"("family");
