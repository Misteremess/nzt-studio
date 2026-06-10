// features/rastreador/components/informe-view.tsx
// Informe de presencia digital de un negocio — pensado para imprimir o
// guardar como PDF y enviarlo al prospecto antes de la primera llamada.
//
// Server Component presentacional. Diseño claro (fondo blanco) con colores
// explícitos, independiente del tema oscuro de la app: lo que se ve en
// pantalla es lo que sale por la impresora.

import type {
  PlaceSignals,
  DetectedOpportunity,
  WebAuditResult,
  OpportunityPriority,
  WebAuditSeverity,
} from "@/features/rastreador/types";
import type { PlaceCacheRow } from "@/features/rastreador/lib/place-cache";
import { computeScore, scoreLabel, SCORE_MAX } from "@/features/rastreador/lib/score";
import { getSectorLabel } from "@/features/rastreador/lib/categories";
import { InformePrintButton } from "@/features/rastreador/components/informe-print-button";

// ─── Static maps ──────────────────────────────────────────────────────────────

const PRIORITY_LABEL: Record<OpportunityPriority, string> = {
  high: "Prioridad alta",
  medium: "Prioridad media",
  low: "Prioridad baja",
};

const PRIORITY_BADGE: Record<OpportunityPriority, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-zinc-100 text-zinc-600",
};

const SEVERITY_LABEL: Record<WebAuditSeverity, string> = {
  high: "Grave",
  medium: "Importante",
  low: "Menor",
};

const SEVERITY_BADGE: Record<WebAuditSeverity, string> = {
  high: "bg-rose-100 text-rose-700",
  medium: "bg-amber-100 text-amber-700",
  low: "bg-zinc-100 text-zinc-600",
};

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="text-sm font-semibold uppercase tracking-wider text-indigo-700 border-b border-zinc-200 pb-1.5 mb-3">
      {children}
    </h2>
  );
}

function CheckRow({ ok, label }: { ok: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span
        className={`flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${
          ok ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
        }`}
      >
        {ok ? "✓" : "✗"}
      </span>
      <span className="text-zinc-700">{label}</span>
    </div>
  );
}

function DataRow({ label, value }: { label: string; value: string | null }) {
  if (!value) return null;
  return (
    <div className="flex gap-2 text-sm">
      <span className="w-28 shrink-0 text-zinc-500">{label}</span>
      <span className="text-zinc-800 font-medium">{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface InformeViewProps {
  row: PlaceCacheRow;
  signals: PlaceSignals | null;
  opportunities: DetectedOpportunity[];
  webAudit: WebAuditResult | null;
}

export function InformeView({ row, signals, opportunities, webAudit }: InformeViewProps) {
  const score = computeScore(opportunities);
  const sector = getSectorLabel(row.primaryType ?? "");
  const today = new Date().toLocaleDateString("es-ES", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });

  return (
    <div className="mx-auto max-w-3xl">
      {/* Barra de acciones — invisible al imprimir */}
      <div className="mb-4 flex justify-end print:hidden">
        <InformePrintButton />
      </div>

      <article className="rounded-lg bg-white p-10 shadow-xl print:rounded-none print:p-8 print:shadow-none">
        {/* ── Cabecera ─────────────────────────────────────────────────── */}
        <header className="mb-8 flex items-start justify-between border-b-2 border-indigo-600 pb-5">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">
              NZT Studio
            </p>
            <h1 className="mt-1 text-2xl font-bold text-zinc-900">
              Informe de presencia digital
            </h1>
          </div>
          <p className="text-xs text-zinc-500 pt-1">{today}</p>
        </header>

        {/* ── Identificación del negocio ───────────────────────────────── */}
        <section className="mb-7">
          <SectionTitle>El negocio</SectionTitle>
          <p className="text-lg font-semibold text-zinc-900">{row.name}</p>
          <div className="mt-2 space-y-1">
            <DataRow label="Dirección" value={row.formattedAddress} />
            <DataRow label="Sector" value={sector || null} />
            <DataRow label="Teléfono" value={row.nationalPhone} />
            <DataRow label="Web" value={row.websiteUri} />
            <DataRow
              label="Reputación"
              value={
                row.rating !== null
                  ? `${row.rating.toFixed(1)} ★ (${row.userRatingCount ?? 0} reseñas en Google)`
                  : null
              }
            />
          </div>
        </section>

        {/* ── Score NZT ────────────────────────────────────────────────── */}
        <section className="mb-7">
          <SectionTitle>Potencial de mejora digital</SectionTitle>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-bold tabular-nums text-zinc-900">
              {score}
              <span className="text-base font-medium text-zinc-400">/{SCORE_MAX}</span>
            </span>
            <div className="flex-1">
              <div className="h-2.5 rounded-full bg-zinc-100 overflow-hidden">
                <div
                  className="h-full rounded-full bg-indigo-600"
                  style={{ width: `${Math.min(100, (score / SCORE_MAX) * 100)}%` }}
                />
              </div>
              <p className="mt-1 text-xs text-zinc-500">{scoreLabel(score)}</p>
            </div>
          </div>
        </section>

        {/* ── Señales digitales ────────────────────────────────────────── */}
        {signals && (
          <section className="mb-7">
            <SectionTitle>Presencia digital actual</SectionTitle>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1.5">
              <CheckRow ok={signals.hasWebsite} label="Página web propia" />
              <CheckRow ok={signals.hasPhone} label="Teléfono publicado" />
              <CheckRow ok={signals.hasOpeningHours} label="Horario publicado en Google" />
              <CheckRow ok={signals.hasRating} label="Reseñas en Google" />
              <CheckRow ok={signals.highReputation} label="Reputación alta (4.2★ o más)" />
              <CheckRow ok={!signals.lowReviewCount} label="Volumen de reseñas saludable" />
            </div>
          </section>
        )}

        {/* ── Auditoría web ────────────────────────────────────────────── */}
        {webAudit && (
          <section className="mb-7">
            <SectionTitle>Estado de la página web</SectionTitle>

            <div className="mb-3 flex items-center gap-4">
              <span className="text-3xl font-bold tabular-nums text-zinc-900">
                {webAudit.score}
                <span className="text-base font-medium text-zinc-400">/100</span>
              </span>
              <p className="text-xs text-zinc-500">
                Revisión técnica de {webAudit.url}
                {webAudit.responseTimeMs !== null &&
                  webAudit.reachable &&
                  ` · respondió en ${(webAudit.responseTimeMs / 1000).toFixed(1)}s`}
              </p>
            </div>

            {webAudit.reachable && (
              <div className="mb-3 grid grid-cols-2 gap-x-6 gap-y-1.5">
                <CheckRow ok={webAudit.usesHttps} label="Conexión segura (HTTPS)" />
                <CheckRow ok={webAudit.hasViewport} label="Adaptada a móvil" />
                <CheckRow ok={!!webAudit.title} label="Título para buscadores" />
                <CheckRow ok={webAudit.hasMetaDescription} label="Descripción para buscadores" />
                <CheckRow ok={webAudit.hasAnalytics} label="Analítica de visitas" />
                <CheckRow ok={webAudit.hasContactForm} label="Formulario de contacto" />
              </div>
            )}

            {webAudit.issues.length > 0 && (
              <div className="space-y-2">
                {webAudit.issues.map((issue) => (
                  <div key={issue.id} className="rounded-md border border-zinc-200 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-zinc-800">{issue.label}</p>
                      <span
                        className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${SEVERITY_BADGE[issue.severity]}`}
                      >
                        {SEVERITY_LABEL[issue.severity]}
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-relaxed text-zinc-600">{issue.detail}</p>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}

        {/* ── Oportunidades ────────────────────────────────────────────── */}
        {opportunities.length > 0 && (
          <section className="mb-7">
            <SectionTitle>Oportunidades detectadas</SectionTitle>
            <div className="space-y-3">
              {opportunities.map((opp) => (
                <div key={opp.id} className="rounded-md border border-zinc-200 p-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-sm font-semibold text-zinc-900">{opp.title}</p>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${PRIORITY_BADGE[opp.priority]}`}
                    >
                      {PRIORITY_LABEL[opp.priority]}
                    </span>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-zinc-600">{opp.reason}</p>
                  <p className="mt-2 border-t border-zinc-100 pt-2 text-xs leading-relaxed text-zinc-700">
                    <span className="font-semibold text-indigo-700">Propuesta: </span>
                    {opp.suggestedMvp}
                  </p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Pie ──────────────────────────────────────────────────────── */}
        <footer className="border-t border-zinc-200 pt-4">
          <p className="text-[10px] leading-relaxed text-zinc-400">
            Informe generado por NZT Studio el {today}. Datos de negocio: Google
            Places API. Revisión web realizada de forma automática sobre el HTML
            público de la página — análisis orientativo, no exhaustivo.
          </p>
        </footer>
      </article>
    </div>
  );
}
