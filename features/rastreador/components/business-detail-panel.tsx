"use client";

// features/rastreador/components/business-detail-panel.tsx

import Link from "next/link";
import {
  Globe,
  Phone,
  Map,
  Building2,
  Loader2,
  Sparkles,
  FileText,
  ShieldAlert,
  CheckCircle2,
  RefreshCw,
  Target,
  PenTool,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { computeScore, scoreLabel, SCORE_MAX } from "@/features/rastreador/lib/score";
import type {
  PlaceDetail,
  PlaceSignals,
  DetectedOpportunity,
  OpportunityPriority,
  WebAuditResult,
  WebAuditSeverity,
} from "@/features/rastreador/types";

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

/** Relative "hace X" string for the last detail refresh timestamp. */
function relativeUpdatedLabel(isoDate: string): string {
  const diffMs = Date.now() - new Date(isoDate).getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "hace un momento";
  if (diffMin < 60) return `hace ${diffMin} min`;
  const diffHours = Math.floor(diffMin / 60);
  if (diffHours < 24) return `hace ${diffHours} h`;
  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return "hace 1 día";
  return `hace ${diffDays} días`;
}

function scoreStyle(score: number): { label: string; color: string; bar: string } {
  if (score === 0) return { label: scoreLabel(score), color: "text-muted-foreground", bar: "bg-muted" };
  if (score <= 2) return { label: scoreLabel(score), color: "text-slate-400", bar: "bg-slate-500" };
  if (score <= 5) return { label: scoreLabel(score), color: "text-amber-400", bar: "bg-amber-500" };
  return { label: scoreLabel(score), color: "text-emerald-400", bar: "bg-emerald-500" };
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

// ─── Web audit section ────────────────────────────────────────────────────────

const SEVERITY_CLASSES: Record<WebAuditSeverity, string> = {
  high: "text-rose-400",
  medium: "text-amber-400",
  low: "text-slate-400",
};

function auditScoreStyle(score: number): { color: string; bar: string } {
  if (score >= 75) return { color: "text-emerald-400", bar: "bg-emerald-500" };
  if (score >= 45) return { color: "text-amber-400", bar: "bg-amber-500" };
  return { color: "text-rose-400", bar: "bg-rose-500" };
}

function WebAuditSection({
  audit,
  isAuditing,
  auditError,
}: {
  audit: WebAuditResult | null;
  isAuditing: boolean;
  auditError: string | null;
}) {
  if (isAuditing) {
    return (
      <div>
        <SectionLabel>Auditoría web</SectionLabel>
        <div className="flex items-center gap-2 py-2 text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          <span className="text-xs">Analizando la web del negocio...</span>
        </div>
      </div>
    );
  }

  if (auditError) {
    return (
      <div>
        <SectionLabel>Auditoría web</SectionLabel>
        <p className="text-xs text-rose-400">{auditError}</p>
      </div>
    );
  }

  if (!audit) return null;

  const { color, bar } = auditScoreStyle(audit.score);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <SectionLabel>Auditoría web</SectionLabel>
        <span className={`text-xs font-bold tabular-nums ${color}`}>
          {audit.score}/100
        </span>
      </div>

      <div className="h-1.5 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${bar}`}
          style={{ width: `${audit.score}%` }}
        />
      </div>

      {audit.reachable && audit.issues.length === 0 && (
        <p className="mt-2 flex items-center gap-1.5 text-xs text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" />
          Sin problemas detectados en la revisión básica.
        </p>
      )}

      {audit.issues.length > 0 && (
        <ul className="mt-2 space-y-1.5">
          {audit.issues.map((issue) => (
            <li key={issue.id} className="flex items-start gap-1.5">
              <ShieldAlert
                className={`h-3.5 w-3.5 mt-0.5 shrink-0 ${SEVERITY_CLASSES[issue.severity]}`}
              />
              <div>
                <p className={`text-xs font-medium ${SEVERITY_CLASSES[issue.severity]}`}>
                  {issue.label}
                </p>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {issue.detail}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}

      {audit.responseTimeMs !== null && audit.reachable && (
        <p className="mt-1.5 text-[10px] text-muted-foreground/60">
          Respuesta en {(audit.responseTimeMs / 1000).toFixed(1)}s · auditada el{" "}
          {new Date(audit.auditedAt).toLocaleDateString("es-ES")}
        </p>
      )}
    </div>
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
  webAudit: WebAuditResult | null;
  isAuditing: boolean;
  auditError: string | null;
  detailFetchedAt: string | null;
  isRefreshing: boolean;
  onRefresh: () => void;
  refreshError: string | null;
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
  webAudit,
  isAuditing,
  auditError,
  detailFetchedAt,
  isRefreshing,
  onRefresh,
  refreshError,
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

        <div className="mt-1.5 flex items-center gap-2">
          {detailFetchedAt && (
            <span className="text-[11px] text-muted-foreground/70">
              Datos actualizados {relativeUpdatedLabel(detailFetchedAt)}
            </span>
          )}
          <button
            type="button"
            onClick={onRefresh}
            disabled={isRefreshing}
            className="inline-flex items-center gap-1 text-[11px] text-indigo-400 hover:text-indigo-300 transition-colors disabled:opacity-60"
          >
            <RefreshCw className={`h-3 w-3 ${isRefreshing ? "animate-spin" : ""}`} />
            {isRefreshing ? "Actualizando..." : "Actualizar datos"}
          </button>
        </div>
        {refreshError && (
          <p className="mt-1 text-[11px] text-rose-400">{refreshError}</p>
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

      {/* ── Web audit (solo si el negocio tiene web) ─────────────────── */}
      {detail.websiteUri && (
        <WebAuditSection
          audit={webAudit}
          isAuditing={isAuditing}
          auditError={auditError}
        />
      )}

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

      {/* ── Analizar con IA (handoff to Analyzer module) ────────────── */}
      {!isPermanentlyClosed && (
        <div className="space-y-1.5">
          <Button asChild variant="secondary" className="w-full">
            <Link href={`/analyzer?placeId=${encodeURIComponent(detail.placeId)}`}>
              <Sparkles className="h-4 w-4 mr-2" />
              Analizar con IA
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link
              href={`/rastreador/informe/${encodeURIComponent(detail.placeId)}`}
              target="_blank"
            >
              <FileText className="h-4 w-4 mr-2" />
              Informe de presencia digital
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/competitor-radar?placeId=${encodeURIComponent(detail.placeId)}`}>
              <Target className="h-4 w-4 mr-2" />
              Radar de competencia
            </Link>
          </Button>
          <Button asChild variant="outline" className="w-full">
            <Link href={`/content-seo?placeId=${encodeURIComponent(detail.placeId)}`}>
              <PenTool className="h-4 w-4 mr-2" />
              Plan de contenido
            </Link>
          </Button>
        </div>
      )}

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
      {/* ── Google Places attribution ───────────────────────────────── */}
      <p className="text-[10px] text-muted-foreground/40 text-center pt-1">
        Datos: Google Places API
      </p>
    </div>
  );
}
