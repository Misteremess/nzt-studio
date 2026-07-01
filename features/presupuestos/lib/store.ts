// features/presupuestos/lib/store.ts
// Server-only persistence for budgets (Prisma). Handles the professional
// sequential numbering (PRES-YYYY-NNNN) and CRUD used by the Server Actions.
import "server-only";

import type { Budget } from "@prisma/client";

import { prisma } from "@/db/prisma";
import type { SaveBudgetInput } from "@/features/presupuestos/schemas";
import type {
  BudgetItem,
  BudgetRecord,
  BudgetStatus,
} from "@/features/presupuestos/types";

/** Formats a year + sequence into the human-readable budget number. */
function formatNumber(year: number, seq: number): string {
  return `PRES-${year}-${String(seq).padStart(4, "0")}`;
}

/** Safely coerces the stored JSON items back into typed BudgetItem[]. */
function parseItems(value: unknown): BudgetItem[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((raw) => {
    if (typeof raw !== "object" || raw === null) return [];
    const r = raw as Record<string, unknown>;
    return [
      {
        concept: typeof r.concept === "string" ? r.concept : "",
        description: typeof r.description === "string" ? r.description : "",
        quantity: typeof r.quantity === "number" ? r.quantity : 0,
        unitPrice: typeof r.unitPrice === "number" ? r.unitPrice : 0,
      },
    ];
  });
}

/** Maps a Prisma Budget row to the client-facing BudgetRecord. */
function rowToRecord(row: Budget): BudgetRecord {
  return {
    id: row.id,
    number: row.number,
    title: row.title,
    intro: row.intro,
    client: {
      name: row.clientName,
      taxId: row.clientTaxId ?? "",
      address: row.clientAddress ?? "",
      email: row.clientEmail ?? "",
      phone: row.clientPhone ?? "",
    },
    companyId: row.companyId,
    items: parseItems(row.items),
    notes: row.notes,
    paymentTerms: row.paymentTerms,
    validityDays: row.validityDays,
    taxRate: row.taxRate,
    discountRate: row.discountRate,
    signatories: { maximo: row.signedByMaximo, ignacio: row.signedByIgnacio },
    status: row.status as BudgetStatus,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/** Lists budgets newest-first. */
export async function listBudgets(): Promise<BudgetRecord[]> {
  const rows = await prisma.budget.findMany({ orderBy: { createdAt: "desc" } });
  return rows.map(rowToRecord);
}

/** Fetches a single budget by id, or null. */
export async function getBudget(id: string): Promise<BudgetRecord | null> {
  const row = await prisma.budget.findUnique({ where: { id } });
  return row ? rowToRecord(row) : null;
}

/**
 * Creates a new budget, assigning the next sequential number for the current
 * year inside a transaction so concurrent saves never collide on (year, seq).
 */
export async function createBudget(
  input: SaveBudgetInput,
  ai?: { model: string; raw: unknown }
): Promise<BudgetRecord> {
  const year = new Date().getFullYear();

  const row = await prisma.$transaction(async (tx) => {
    const last = await tx.budget.findFirst({
      where: { year },
      orderBy: { seq: "desc" },
      select: { seq: true },
    });
    const seq = (last?.seq ?? 0) + 1;

    return tx.budget.create({
      data: {
        number: formatNumber(year, seq),
        year,
        seq,
        clientName: input.client.name,
        clientTaxId: input.client.taxId || null,
        clientAddress: input.client.address || null,
        clientEmail: input.client.email || null,
        clientPhone: input.client.phone || null,
        companyId: input.companyId,
        title: input.title,
        intro: input.intro || null,
        items: input.items,
        notes: input.notes || null,
        paymentTerms: input.paymentTerms || null,
        validityDays: input.validityDays,
        taxRate: input.taxRate,
        discountRate: input.discountRate,
        signedByMaximo: input.signatories.maximo,
        signedByIgnacio: input.signatories.ignacio,
        aiModel: ai?.model ?? null,
        aiRaw: ai ? (ai.raw as object) : undefined,
      },
    });
  });

  return rowToRecord(row);
}

/** Updates an existing budget's editable content (never re-numbers it). */
export async function updateBudget(
  id: string,
  input: SaveBudgetInput
): Promise<BudgetRecord> {
  const row = await prisma.budget.update({
    where: { id },
    data: {
      clientName: input.client.name,
      clientTaxId: input.client.taxId || null,
      clientAddress: input.client.address || null,
      clientEmail: input.client.email || null,
      clientPhone: input.client.phone || null,
      companyId: input.companyId,
      title: input.title,
      intro: input.intro || null,
      items: input.items,
      notes: input.notes || null,
      paymentTerms: input.paymentTerms || null,
      validityDays: input.validityDays,
      taxRate: input.taxRate,
      discountRate: input.discountRate,
      signedByMaximo: input.signatories.maximo,
      signedByIgnacio: input.signatories.ignacio,
    },
  });
  return rowToRecord(row);
}

/** Updates just the status of a budget. */
export async function updateBudgetStatus(
  id: string,
  status: BudgetStatus
): Promise<void> {
  await prisma.budget.update({ where: { id }, data: { status } });
}

/** Permanently deletes a budget. */
export async function deleteBudget(id: string): Promise<void> {
  await prisma.budget.delete({ where: { id } });
}
