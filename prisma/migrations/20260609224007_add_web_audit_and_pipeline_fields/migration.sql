-- AlterTable
ALTER TABLE "companies" ADD COLUMN     "lastContactAt" TIMESTAMP(3),
ADD COLUMN     "nextAction" TEXT;

-- AlterTable
ALTER TABLE "place_cache" ADD COLUMN     "webAudit" JSONB,
ADD COLUMN     "webAuditFetchedAt" TIMESTAMP(3);
