-- AlterTable
ALTER TABLE "ai_mvp_specs" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ai_pricings" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "ai_proposals" ADD COLUMN     "archivedAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "business_analyses" ADD COLUMN     "archivedAt" TIMESTAMP(3);
