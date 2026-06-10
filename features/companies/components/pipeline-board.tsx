"use client";

// features/companies/components/pipeline-board.tsx
// Tablero kanban del pipeline de ventas: una columna por CompanyStatus.
// Drag & drop nativo HTML5 (sin dependencias). Las mutaciones son optimistas:
// la tarjeta se mueve al instante y se revierte si la server action falla.

import { useState, useTransition } from "react";
import Link from "next/link";
import { ExternalLink, PhoneCall, Loader2, Pencil } from "lucide-react";

import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { STATUS_CONFIG, ALL_STATUSES } from "@/features/companies/lib/status";
import {
  updateCompanyStatusAction,
  registerContactAction,
  updateNextActionAction,
} from "@/features/companies/actions";
import type { CompanyStatus, PipelineCompany } from "@/features/companies/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysSince(date: Date): number {
  return Math.floor((Date.now() - new Date(date).getTime()) / 86_400_000);
}

function contactLabel(lastContactAt: Date | null): string {
  if (!lastContactAt) return "Sin contacto registrado";
  const days = daysSince(lastContactAt);
  if (days === 0) return "Contactada hoy";
  if (days === 1) return "Contactada ayer";
  return `Último contacto hace ${days} días`;
}

/** Sin contacto en 14+ días con estado activo = seguimiento frío */
function isStale(company: PipelineCompany): boolean {
  if (company.status === "CLIENT" || company.status === "INACTIVE") return false;
  if (!company.lastContactAt) return false;
  return daysSince(company.lastContactAt) >= 14;
}

// ─── Card ─────────────────────────────────────────────────────────────────────

function PipelineCard({
  company,
  onRegisterContact,
  onSaveNextAction,
}: {
  company: PipelineCompany;
  onRegisterContact: (id: string) => void;
  onSaveNextAction: (id: string, value: string) => void;
}) {
  const [isEditingAction, setIsEditingAction] = useState(false);
  const [draft, setDraft] = useState(company.nextAction ?? "");

  const meta = [company.sector, company.city].filter(Boolean).join(" · ");

  function commitNextAction() {
    setIsEditingAction(false);
    if (draft.trim() !== (company.nextAction ?? "")) {
      onSaveNextAction(company.id, draft);
    }
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData("text/plain", company.id);
        e.dataTransfer.effectAllowed = "move";
      }}
      className="group cursor-grab rounded-md border border-border bg-card p-3 space-y-2 active:cursor-grabbing hover:border-border/80 hover:bg-accent/30 transition-colors"
    >
      <div className="flex items-start justify-between gap-2">
        <p className="text-sm font-medium text-foreground leading-snug">{company.name}</p>
        <Link
          href={`/companies/${company.id}`}
          className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-foreground transition-opacity shrink-0"
          title="Ver empresa"
        >
          <ExternalLink className="h-3.5 w-3.5" />
        </Link>
      </div>

      {meta && <p className="text-xs text-muted-foreground">{meta}</p>}

      <div className="flex items-center justify-between gap-2">
        <p
          className={cn(
            "text-[11px]",
            isStale(company) ? "text-amber-400 font-medium" : "text-muted-foreground/70"
          )}
        >
          {contactLabel(company.lastContactAt)}
        </p>
        <button
          onClick={() => onRegisterContact(company.id)}
          className="flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors shrink-0"
          title="Registrar contacto hoy"
        >
          <PhoneCall className="h-3 w-3" />
          Contacto hoy
        </button>
      </div>

      {isEditingAction ? (
        <input
          autoFocus
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commitNextAction}
          onKeyDown={(e) => {
            if (e.key === "Enter") commitNextAction();
            if (e.key === "Escape") {
              setDraft(company.nextAction ?? "");
              setIsEditingAction(false);
            }
          }}
          placeholder="Próxima acción..."
          className="w-full rounded border border-border bg-background px-2 py-1 text-[11px] text-foreground outline-none focus:border-indigo-500"
        />
      ) : (
        <button
          onClick={() => setIsEditingAction(true)}
          className="flex w-full items-center gap-1 text-left text-[11px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <Pencil className="h-3 w-3 shrink-0 opacity-50" />
          {company.nextAction ?? (
            <span className="italic opacity-60">Definir próxima acción</span>
          )}
        </button>
      )}
    </div>
  );
}

// ─── Board ────────────────────────────────────────────────────────────────────

export function PipelineBoard({ companies }: { companies: PipelineCompany[] }) {
  // Copia local para mutaciones optimistas; el servidor revalida después.
  const [items, setItems] = useState<PipelineCompany[]>(companies);
  const [dragOverStatus, setDragOverStatus] = useState<CompanyStatus | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function moveCompany(companyId: string, status: CompanyStatus) {
    const previous = items;
    const company = previous.find((c) => c.id === companyId);
    if (!company || company.status === status) return;

    setError(null);
    setItems(previous.map((c) => (c.id === companyId ? { ...c, status } : c)));

    startTransition(async () => {
      const result = await updateCompanyStatusAction(companyId, status);
      if (!result.ok) {
        setItems(previous);
        setError(result.error);
      }
    });
  }

  function handleRegisterContact(companyId: string) {
    const previous = items;
    setError(null);
    setItems(
      previous.map((c) =>
        c.id === companyId ? { ...c, lastContactAt: new Date() } : c
      )
    );

    startTransition(async () => {
      const result = await registerContactAction(companyId);
      if (!result.ok) {
        setItems(previous);
        setError(result.error);
      }
    });
  }

  function handleSaveNextAction(companyId: string, value: string) {
    const previous = items;
    const trimmed = value.trim();
    setError(null);
    setItems(
      previous.map((c) =>
        c.id === companyId ? { ...c, nextAction: trimmed === "" ? null : trimmed } : c
      )
    );

    startTransition(async () => {
      const result = await updateNextActionAction(companyId, value);
      if (!result.ok) {
        setItems(previous);
        setError(result.error);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between min-h-5">
        {error ? (
          <p className="text-xs text-rose-400">{error}</p>
        ) : (
          <p className="text-xs text-muted-foreground">
            Arrastra las tarjetas entre columnas para mover empresas por el pipeline.
          </p>
        )}
        {isPending && (
          <Loader2 className="h-3.5 w-3.5 animate-spin text-muted-foreground" />
        )}
      </div>

      {/* flex + min-w por columna: en pantallas estrechas aparece scroll
          horizontal en vez de comprimir las tarjetas hasta romperlas */}
      <div className="flex items-start gap-3 overflow-x-auto pb-2">
        {ALL_STATUSES.map((status) => {
          const columnCompanies = items.filter((c) => c.status === status);
          const config = STATUS_CONFIG[status];

          return (
            <div
              key={status}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
                setDragOverStatus(status);
              }}
              onDragLeave={() => setDragOverStatus(null)}
              onDrop={(e) => {
                e.preventDefault();
                setDragOverStatus(null);
                const companyId = e.dataTransfer.getData("text/plain");
                if (companyId) moveCompany(companyId, status);
              }}
              className={cn(
                "min-w-52 flex-1 rounded-lg border bg-card/50 p-2 min-h-48 transition-colors",
                dragOverStatus === status
                  ? "border-indigo-500/60 bg-indigo-500/5"
                  : "border-border/60"
              )}
            >
              <div className="flex items-center justify-between px-1 pb-2">
                <Badge variant="outline" className={`text-xs ${config.badgeClass}`}>
                  {config.label}
                </Badge>
                <span className="text-xs tabular-nums text-muted-foreground">
                  {columnCompanies.length}
                </span>
              </div>

              <div className="space-y-2">
                {columnCompanies.map((company) => (
                  <PipelineCard
                    key={company.id}
                    company={company}
                    onRegisterContact={handleRegisterContact}
                    onSaveNextAction={handleSaveNextAction}
                  />
                ))}
                {columnCompanies.length === 0 && (
                  <p className="px-1 py-6 text-center text-[11px] text-muted-foreground/50">
                    Sin empresas
                  </p>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
