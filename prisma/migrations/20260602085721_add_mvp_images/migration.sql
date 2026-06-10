-- CreateTable
CREATE TABLE "ai_mvp_images" (
    "id" TEXT NOT NULL,
    "mvpSpecId" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "data" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ai_mvp_images_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_mvp_images_mvpSpecId_kind_key" ON "ai_mvp_images"("mvpSpecId", "kind");

-- AddForeignKey
ALTER TABLE "ai_mvp_images" ADD CONSTRAINT "ai_mvp_images_mvpSpecId_fkey" FOREIGN KEY ("mvpSpecId") REFERENCES "ai_mvp_specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;
