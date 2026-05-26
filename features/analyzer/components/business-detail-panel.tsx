"use client";

// features/analyzer/components/business-detail-panel.tsx

import Link from "next/link";
import { Globe, Phone, Map, Building2, Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import type {
  PlaceDetail,
  PlaceSignals,
  DetectedOpportunity,
  OpportunityPriority,
} from "@/features/analyzer/types";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function safeHref(url: string | null): string | null {
  if (!url) return null;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `https://${url}`;
}

const PRIORITY_LABEL: Record<OpportunityPriority, string> = {
  high: "Alta",
  medium: "Media",
  low: "Baja",
};

const PRIORITY_CLASSES: Record<OpportunityPriority, string> = {
  high: "bg-rose-500/10 text-rose-400 border-rose-500/20",
  medium: "bg-amber-500/10 text-amber-400 border-amber-500/20",
  low: "bg-slate-500/10 text-slate-400 border-slate-500/20",
};

const SCORE_MAX = 9; // practical ceiling: 3 high opportunities

function computeScore(opps: DetectedOpportunity[]): number {
  const w: Record<OpportunityPriority, number> = { high: 3, medium: 2, low: 1 };
  return opps.reduce((s, o) => s + w[o.priority], 0);
}

function scoreStyle(score: number): { label: string; color: string; bar: string } {
  if (score === 0) return { label: "Sin potencial detectado", color: "text-muted-foreground", bar: "bg-muted" };
  if (score <= 2) return { label: "Potencial bajo", color: "text-slate-400", bar: "bg-slate-500" };
  if (score <= 5) return { label: "Potencial medio", color: "text-amber-400", bar: "bg-amber-500" };
  return { label: "Potencial alto", color: "text-emerald-400", bar: "bg-emerald-500" };
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-2">
      {children}
    </p>
  );
}

function SignalChip({
  label,
  variant,
}: {
  label: string;
  variant: "positive" | "negative" | "warning" | "neutral";
}) {
  const cls = {
    positive: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
    negative: "bg-rose-500/10 text-rose-400 border-rose-500/20",
    warning: "bg-amber-500/10 text-amber-400 border-amber-500/20",
    neutral: "bg-slate-500/10 text-slate-400 border-slate-500/20",
  }[variant];

  return (
    <Badge variant="outline" className={`text-xs ${cls}`}>
      {label}
    </Badge>
  );
}

function OpportunityCard({ opp }: { opp: DetectedOpportunity }) {
  return (
    <Card className="border-border/50">
      <CardContent className="p-3 space-y-1.5">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium text-foreground leading-snug">{opp.title}</p>
          <Badge
            variant="outline"
            className={`text-xs shrink-0 ${PRIORITY_CLASSES[opp.priority]}`}
          >
            {PRIORITY_LABEL[opp.priority]}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground leading-relaxed">{opp.reason}</p>
        <div className="pt-1.5 border-t border-border/40">
          <p className="text-xs leading-relaxed text-foreground/70">
            <span className="font-medium text-indigo-400/90">MVP sugerido: </span>
            {opp.suggestedMvp}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export interface BusinessDetailPanelProps {
  detail: PlaceDetail;
  signals: PlaceSignals;
  opportunities: DetectedOpportunity[];
  fromCache: boolean;
  companyId: string | null;
  savedCompanyId: string | null;
  isSaving: boolean;
  onSave: () => void;
  saveError: string | null;
}

export function BusinessDetailPanel({
  detail,
  signals,
  opportunities,
  fromCache,
  companyId,
  savedCompanyId,
  isSaving,
  onSave,
  saveError,
}: BusinessDetailPanelProps) {
  const effectiveCompanyId = savedCompanyId ?? companyId;
  const isPermanentlyClosed = detail.businessStatus === "CLOSED_PERMANENTLY";
  const mapsUrl = safeHref(detail.googleMapsUri);
  const websiteUrl = safeHref(detail.websiteUri);

  const score = computeScore(opportunities);
  const scorePct = Math.min(100, (score / SCORE_MAX) * 100);
  const { label: scoreLabel, color: scoreColor, bar: scoreBar } = scoreStyle(score);

  return (
    <div className="space-y-4">
      {/* ── Business header ─────────────────────────────────────────── */}
      <div>
        <div className="flex items-start gap-2 justify-between flex-wrap">
          <h3 className="text-base font-semibold text-foreground leading-tight">
            {detail.name}
          </h3>

          <div className="flex items-center gap-1.5 flex-wrap">
            {detail.businessStatus === "OPERATIONAL" && (
              <Badge variant="outline" className="text-xs bg-emerald-500/10 text-emerald-400 border-emerald-500/30">
                Abierto
              </Badge>
            )}
            {detail.businessStatus === "CLOSED_TEMPORARILY" && (
              <Badge variant="outline" className="text-xs bg-amber-500/10 text-amber-400 border-amber-500/30">
                Cerrado temp.
              </Badge>
            )}
            {isPermanentlyClosed && (
              <Badge variant="outline" className="text-xs bg-rose-500/10 text-rose-400 border-rose-500/30">
                Cerrado perm.
              </Badge>
            )}
            {fromCache && (
              <Badge variant="outline" className="text-xs text-muted-foreground border-muted-foreground/25">
                Caché
              </Badge>
            )}
          </div>
        </div>

        {detail.formattedAddress && (
          <p className="mt-1 text-xs text-muted-foreground">{detail.formattedAddress}</p>
        )}

        <div className="mt-2 flex items-center flex-wrap gap-x-4 gap-y-1">
          {detail.rating !== null && (
            <span className="text-sm text-foreground">
              ⭐ {detail.rating.toFixed(1)}{" "}
              <span className="text-xs text-muted-foreground">
                ({detail.userRatingCount ?? 0} reseñas)
              </span>
            </span>
          )}
          {mapsUrl && (
            <a href={mapsUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <Map className="h-3 w-3" />Google Maps
            </a>
          )}
          {websiteUrl && (
            <a href={websiteUrl} target="_blank" rel="noopener noreferrer"
              className="flex items-center gap-1 text-xs text-indigo-400 hover:text-indigo-300 transition-colors">
              <Globe className="h-3 w-3" />Web
            </a>
          )}
          {detail.nationalPhone && (
            <span className="flex items-center gap-1 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" />{detail.nationalPhone}
            </span>
          )}
        </div>
      </div>

      <Separator />

      {/* ── Score NZT ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <SectionLabel>Score NZT</SectionLabel>
          <span className={`text-xs font-bold tabular-nums ${scoreColor}`}>
            {score}/{SCORE_MAX}
          </span>
        </div>
        <div className="h-1.5 rounded-full bg-muted overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-500 ${scoreBar}`}
            style={{ width: `${scorePct}%` }}
          />
        </div>
        <p className={`mt-1 text-[11px] ${scoreColor}`}>{scoreLabel}</p>
      </div>

      {/* ── Digital signals ─────────────────────────────────────────── */}
      <div>
        <SectionLabel>Señales digitales</SectionLabel>
        <div className="flex flex-wrap gap-1.5">
          {signals.missingWebsite ? (
            <SignalChip label="Sin web propia" variant="negative" />
          ) : (
            <SignalChip label="Tiene web" variant="positive" />
          )}
          {signals.missingPhone ? (
            <SignalChip label="Sin teléfono" variant="warning" />
          ) : (
            <SignalChip label="Tiene teléfono" variant="positive" />
          )}
          {signals.highReputation && (
            <SignalChip label="Alta reputación" variant="positive" />
          )}
          {signals.lowReviewCount && (
            <SignalChip label="Pocas reseñas" variant="warning" />
          )}
          {detail.hasOpeningHours && (
            <SignalChip label="Horario publicado" variant="neutral" />
          )}
          {signals.closedOrTemporary && (
            <SignalChip label="No operativo" variant="negative" />
          )}
        </div>
      </div>

      {/* ── Opportunities ───────────────────────────────────────────── */}
      {opportunities.length > 0 && (
        <div>
          <SectionLabel>
            Oportunidades detectadas ({opportunities.length})
          </SectionLabel>
          <div className="space-y-2">
            {opportunities.map((opp) => (
              <OpportunityCard key={opp.id} opp={opp} />
            ))}
          </div>
        </div>
      )}

      {isPermanentlyClosed && opportunities.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          Negocio cerrado permanentemente — sin oportunidades.
        </p>
      )}

      {!isPermanentlyClosed && opportunities.length === 0 && (
        <p className="text-sm text-muted-foreground text-center py-2">
          No se detectaron oportunidades claras para este negocio.
        </p>
      )}

      <Separator />

      {/* ── Save / Already saved ────────────────────────────────────── */}
      {effectiveCompanyId ? (
        <div className="flex items-center justify-between gap-3">
          <p className="text-xs text-muted-foreground">Guardado como empresa candidata</p>
          <Button asChild variant="outline" size="sm">
            <Link href={`/companies/${effectiveCompanyId}`}>Ver empresa →</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Button
            className="w-full"
            onClick={onSave}
            disabled={isSaving || isPermanentlyClosed}
          >
            {isSaving ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <Building2 className="h-4 w-4 mr-2" />
                Guardar como candidata
              </>
            )}
          </Button>
          {saveError && (
            <p className="text-xs text-rose-400 text-center">{saveError}</p>
          )}
        </div>
      )}
    </div>
  );
}
