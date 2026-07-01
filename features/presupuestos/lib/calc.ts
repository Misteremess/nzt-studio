// features/presupuestos/lib/calc.ts
// Pure, client-safe money math for budgets. Shared by the form, the HTML preview
// and the PDF document so the numbers always match. All rounding is to cents.

import type { BudgetItem, BudgetTotals } from "@/features/presupuestos/types";

/** Rounds to 2 decimals avoiding binary float drift (e.g. 1.005 → 1.01). */
export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/** Line total for a single item (quantity · unitPrice), rounded to cents. */
export function lineTotal(item: BudgetItem): number {
  return round2((item.quantity || 0) * (item.unitPrice || 0));
}

/**
 * Computes subtotal, discount, taxable base, tax and total for a budget.
 * `discountRate` and `taxRate` are percentages (e.g. 21 for 21% IVA).
 */
export function computeTotals(
  items: BudgetItem[],
  taxRate: number,
  discountRate: number
): BudgetTotals {
  const subtotal = round2(items.reduce((sum, it) => sum + lineTotal(it), 0));
  const discount = round2(subtotal * (Math.max(0, discountRate) / 100));
  const taxBase = round2(subtotal - discount);
  const tax = round2(taxBase * (Math.max(0, taxRate) / 100));
  const total = round2(taxBase + tax);
  return { subtotal, discount, taxBase, tax, total };
}

/** Formats an amount as EUR in Spanish locale (e.g. "1.234,50 €"). */
export function formatEur(amount: number): string {
  return new Intl.NumberFormat("es-ES", {
    style: "currency",
    currency: "EUR",
  }).format(amount);
}
