-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('QUEUED', 'IN_PROGRESS', 'IN_REVIEW', 'DELIVERED', 'ON_HOLD', 'CANCELLED');

-- CreateTable
CREATE TABLE "ai_deliveries" (
    "id" TEXT NOT NULL,
    "mvpSpecId" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "repoUrl" TEXT,
    "deployUrl" TEXT,
    "notes" TEXT,
    "startedAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ai_delivery_tasks" (
    "id" TEXT NOT NULL,
    "deliveryId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "done" BOOLEAN NOT NULL DEFAULT false,
    "position" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ai_delivery_tasks_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "ai_deliveries_mvpSpecId_key" ON "ai_deliveries"("mvpSpecId");

-- CreateIndex
CREATE INDEX "ai_delivery_tasks_deliveryId_idx" ON "ai_delivery_tasks"("deliveryId");

-- AddForeignKey
ALTER TABLE "ai_deliveries" ADD CONSTRAINT "ai_deliveries_mvpSpecId_fkey" FOREIGN KEY ("mvpSpecId") REFERENCES "ai_mvp_specs"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ai_delivery_tasks" ADD CONSTRAINT "ai_delivery_tasks_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "ai_deliveries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
