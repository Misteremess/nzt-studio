-- CreateEnum
CREATE TYPE "BudgetStatus" AS ENUM ('DRAFT', 'SENT', 'ACCEPTED', 'REJECTED');

-- CreateTable
CREATE TABLE "budgets" (
    "id" TEXT NOT NULL,
    "number" TEXT NOT NULL,
    "year" INTEGER NOT NULL,
    "seq" INTEGER NOT NULL,
    "clientName" TEXT NOT NULL,
    "clientTaxId" TEXT,
    "clientAddress" TEXT,
    "clientEmail" TEXT,
    "clientPhone" TEXT,
    "companyId" TEXT,
    "title" TEXT NOT NULL,
    "intro" TEXT,
    "items" JSONB NOT NULL,
    "notes" TEXT,
    "paymentTerms" TEXT,
    "validityDays" INTEGER NOT NULL DEFAULT 30,
    "taxRate" DOUBLE PRECISION NOT NULL DEFAULT 21,
    "discountRate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "signedByMaximo" BOOLEAN NOT NULL DEFAULT false,
    "signedByIgnacio" BOOLEAN NOT NULL DEFAULT false,
    "status" "BudgetStatus" NOT NULL DEFAULT 'DRAFT',
    "aiModel" TEXT,
    "aiRaw" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "budgets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "budgets_number_key" ON "budgets"("number");

-- CreateIndex
CREATE INDEX "budgets_companyId_idx" ON "budgets"("companyId");

-- CreateIndex
CREATE UNIQUE INDEX "budgets_year_seq_key" ON "budgets"("year", "seq");

-- AddForeignKey
ALTER TABLE "budgets" ADD CONSTRAINT "budgets_companyId_fkey" FOREIGN KEY ("companyId") REFERENCES "companies"("id") ON DELETE SET NULL ON UPDATE CASCADE;
