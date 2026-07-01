"use client";
// features/presupuestos/components/budget-download-button.tsx
// Generates the budget PDF on demand entirely client-side. @react-pdf/renderer
// and the document component are dynamically imported inside the click handler
// so they are code-split and never touched during SSR.

import { useState } from "react";
import { Download, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import type { BudgetDocumentData } from "@/features/presupuestos/types";

function safeFileName(data: BudgetDocumentData): string {
  const client = data.client.name.trim().replace(/[^\p{L}\p{N}]+/gu, "-").replace(/^-+|-+$/g, "");
  const base = client ? `${data.number}-${client}` : data.number;
  return `${base}.pdf`.slice(0, 120);
}

export function BudgetDownloadButton({
  data,
  disabled,
  className,
}: {
  data: BudgetDocumentData;
  disabled?: boolean;
  className?: string;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDownload() {
    setBusy(true);
    setError(null);
    try {
      const [{ pdf }, { BudgetPdfDocument }] = await Promise.all([
        import("@react-pdf/renderer"),
        import("@/features/presupuestos/components/budget-pdf-document"),
      ]);
      const blob = await pdf(<BudgetPdfDocument data={data} />).toBlob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = safeFileName(data);
      document.body.appendChild(a);
      a.click();
      a.remove();
      // Revoke on the next tick so the download has started.
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      console.error("[Presupuestos] PDF generation failed", err);
      setError("No se pudo generar el PDF. Inténtalo de nuevo.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className={className}>
      <Button onClick={handleDownload} disabled={disabled || busy} className="w-full">
        {busy ? <Loader2 className="animate-spin" /> : <Download />}
        {busy ? "Generando PDF…" : "Descargar PDF"}
      </Button>
      {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
