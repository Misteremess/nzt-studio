// app/(private)/presupuestos/page.tsx
// Presupuestos — generate professional Hyperfocus budgets with AI and export PDF.

import { requireSession } from "@/lib/auth/require-session";
import { getIssuerSettings } from "@/features/presupuestos/lib/issuer";
import { listBudgets } from "@/features/presupuestos/lib/store";
import { PresupuestosView } from "@/features/presupuestos/components/presupuestos-view";

// Reads per-user budget data from the database on every request.
export const dynamic = "force-dynamic";

export default async function PresupuestosPage() {
  await requireSession();

  const [issuer, budgets] = await Promise.all([getIssuerSettings(), listBudgets()]);

  return (
    <div className="mx-auto w-full max-w-6xl">
      <PresupuestosView initialIssuer={issuer} initialBudgets={budgets} />
    </div>
  );
}
