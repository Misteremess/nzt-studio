"use client";
// features/presupuestos/components/budget-preview.tsx
// Live, on-screen approximation of the budget PDF (white "paper"). Kept visually
// in sync with budget-pdf-document so the user sees what they'll download without
// regenerating a PDF on every keystroke.

import { computeTotals, lineTotal, formatEur } from "@/features/presupuestos/lib/calc";
import {
  BRAND_CYAN,
  HYPERFOCUS_LOGO_PATH,
  SIGNATORY_MAXIMO,
  SIGNATORY_IGNACIO,
} from "@/features/presupuestos/lib/constants";
import type { BudgetDocumentData } from "@/features/presupuestos/types";

function esDate(iso: string): string {
  return new Intl.DateTimeFormat("es-ES", { day: "2-digit", month: "long", year: "numeric" }).format(
    new Date(iso)
  );
}

function validUntil(iso: string, days: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + days);
  return esDate(d.toISOString());
}

export function BudgetPreview({ data }: { data: BudgetDocumentData }) {
  const totals = computeTotals(data.items, data.taxRate, data.discountRate);
  const { issuer, client } = data;
  const signNames = [
    data.signatories.maximo ? SIGNATORY_MAXIMO : null,
    data.signatories.ignacio ? SIGNATORY_IGNACIO : null,
  ].filter((n): n is string => n !== null);

  return (
    <div className="mx-auto w-full max-w-[820px] rounded-lg bg-white p-8 text-[#0B1220] shadow-sm sm:p-10">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <svg viewBox="0 0 880 913" className="h-9 w-9">
            <path d={HYPERFOCUS_LOGO_PATH} fill="#0B1220" fillRule="evenodd" />
          </svg>
          <div>
            <p className="text-xl font-bold tracking-wider">
              {(issuer.companyName || "Hyperfocus").toUpperCase()}
            </p>
            {issuer.fiscalName ? (
              <p className="text-xs text-[#5B6472]">{issuer.fiscalName}</p>
            ) : null}
          </div>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold tracking-[0.2em]">PRESUPUESTO</p>
          <p className="mt-1 text-sm">{data.number}</p>
          <p className="mt-0.5 text-xs text-[#5B6472]">Fecha: {esDate(data.issuedAt)}</p>
          <p className="text-xs text-[#5B6472]">
            Válido hasta: {validUntil(data.issuedAt, data.validityDays)}
          </p>
        </div>
      </div>

      <div className="my-4 h-[3px] rounded" style={{ backgroundColor: BRAND_CYAN }} />

      {/* Parties */}
      <div className="grid grid-cols-2 gap-6">
        {[
          {
            label: "EMISOR",
            name: issuer.companyName,
            lines: [
              issuer.taxId ? `NIF/CIF: ${issuer.taxId}` : "",
              issuer.address,
              issuer.email,
              issuer.phone,
            ],
          },
          {
            label: "CLIENTE",
            name: client.name || "—",
            lines: [
              client.taxId ? `NIF/CIF: ${client.taxId}` : "",
              client.address,
              client.email,
              client.phone,
            ],
          },
        ].map((p) => (
          <div key={p.label}>
            <p className="text-[10px] font-bold tracking-[0.15em]" style={{ color: BRAND_CYAN }}>
              {p.label}
            </p>
            <p className="mt-1 text-sm font-bold">{p.name}</p>
            {p.lines
              .filter((l) => l.trim() !== "")
              .map((l, i) => (
                <p key={i} className="text-xs text-[#5B6472]">
                  {l}
                </p>
              ))}
          </div>
        ))}
      </div>

      {/* Title + intro */}
      <h3 className="mt-6 text-base font-bold">{data.title || "Título del presupuesto"}</h3>
      {data.intro ? <p className="mt-1 text-sm text-[#3A4250]">{data.intro}</p> : null}

      {/* Items table */}
      <div className="mt-4 overflow-hidden rounded">
        <div className="flex bg-[#0B1220] px-3 py-2 text-[10px] font-bold tracking-wide text-white">
          <span className="flex-1">CONCEPTO</span>
          <span className="w-14 text-right">CANT.</span>
          <span className="w-24 text-right">PRECIO</span>
          <span className="w-24 text-right">IMPORTE</span>
        </div>
        {data.items.length === 0 ? (
          <div className="px-3 py-4 text-center text-xs text-[#5B6472]">
            Sin partidas todavía.
          </div>
        ) : (
          data.items.map((item, i) => (
            <div
              key={i}
              className={`flex px-3 py-2 text-sm ${i % 2 === 1 ? "bg-[#F5F7FA]" : ""}`}
            >
              <div className="flex-1 pr-2">
                <p className="font-semibold">{item.concept || "—"}</p>
                {item.description ? (
                  <p className="text-xs text-[#5B6472]">{item.description}</p>
                ) : null}
              </div>
              <span className="w-14 text-right">{item.quantity}</span>
              <span className="w-24 text-right">{formatEur(item.unitPrice)}</span>
              <span className="w-24 text-right">{formatEur(lineTotal(item))}</span>
            </div>
          ))
        )}
      </div>

      {/* Totals */}
      <div className="mt-4 flex justify-end">
        <div className="w-64">
          <div className="flex justify-between py-1 text-sm">
            <span className="text-[#5B6472]">Base imponible</span>
            <span>{formatEur(totals.subtotal)}</span>
          </div>
          {totals.discount > 0 ? (
            <div className="flex justify-between py-1 text-sm">
              <span className="text-[#5B6472]">Descuento ({data.discountRate}%)</span>
              <span>−{formatEur(totals.discount)}</span>
            </div>
          ) : null}
          <div className="flex justify-between py-1 text-sm">
            <span className="text-[#5B6472]">IVA ({data.taxRate}%)</span>
            <span>{formatEur(totals.tax)}</span>
          </div>
          <div className="mt-2 flex items-center justify-between rounded bg-[#0B1220] px-3 py-2">
            <span className="font-bold text-white">TOTAL</span>
            <span className="text-lg font-bold" style={{ color: BRAND_CYAN }}>
              {formatEur(totals.total)}
            </span>
          </div>
        </div>
      </div>

      {/* Payment terms */}
      {data.paymentTerms ? (
        <div className="mt-5">
          <p className="text-[10px] font-bold tracking-[0.15em]" style={{ color: BRAND_CYAN }}>
            CONDICIONES DE PAGO
          </p>
          <p className="mt-1 text-sm text-[#3A4250]">{data.paymentTerms}</p>
          {issuer.iban ? (
            <p className="mt-0.5 text-sm text-[#3A4250]">Transferencia a: {issuer.iban}</p>
          ) : null}
        </div>
      ) : null}

      {/* Notes */}
      {data.notes ? (
        <div className="mt-5">
          <p className="text-[10px] font-bold tracking-[0.15em]" style={{ color: BRAND_CYAN }}>
            NOTAS
          </p>
          <p className="mt-1 text-sm text-[#3A4250]">{data.notes}</p>
        </div>
      ) : null}

      {/* Signature */}
      {signNames.length > 0 ? (
        <div className="mt-8 flex justify-end">
          <div className="w-64">
            <p className="mb-6 text-sm text-[#5B6472]">Atentamente,</p>
            <div className="mb-1 w-52 border-t border-[#0B1220]" />
            {signNames.map((n) => (
              <p key={n} className="text-sm font-bold">
                {n}
              </p>
            ))}
            <p className="text-xs text-[#5B6472]">{issuer.companyName}</p>
          </div>
        </div>
      ) : null}
    </div>
  );
}
