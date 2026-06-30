"use client";

// features/settings/components/settings-view.tsx
// AI settings section: choose which AI provider (Anthropic / Gemini) powers each
// module. Single-user tool — changes persist immediately to the database.
// Rendered inside the settings modal.

import { useState, useTransition } from "react";
import { Check, Loader2, AlertTriangle, Sparkles, Bot } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { setAnthropicModelAction, setModuleProviderAction } from "@/features/settings/actions";
import {
  AI_MODULES,
  AI_PROVIDERS,
  ANTHROPIC_MODELS,
  PROVIDER_META,
  providerModelLabel,
  type AiModuleId,
  type AiProvider,
  type AnthropicModel,
} from "@/lib/ai/types";

const PROVIDER_ICON: Record<AiProvider, React.ReactNode> = {
  anthropic: <Bot className="h-3.5 w-3.5" />,
  gemini: <Sparkles className="h-3.5 w-3.5" />,
};

interface Props {
  providers: Record<AiModuleId, AiProvider>;
  setProvider: (moduleId: AiModuleId, provider: AiProvider) => void;
  keyAvailability: Record<AiProvider, boolean>;
  anthropicModel: AnthropicModel;
  setAnthropicModel: (model: AnthropicModel) => void;
}

export function ProviderSettings({
  providers,
  setProvider,
  keyAvailability,
  anthropicModel,
  setAnthropicModel,
}: Props) {
  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        Elige qué proveedor de IA usa cada módulo. Los cambios se guardan al instante.
      </p>

      {/* Provider legend */}
      <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {AI_PROVIDERS.map((p) => {
          const meta = PROVIDER_META[p];
          const available = keyAvailability[p];
          return (
            <div key={p} className="rounded-lg border border-border bg-card p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground inline-flex items-center gap-1.5">
                  {PROVIDER_ICON[p]}
                  {meta.label}
                </span>
                {meta.free ? (
                  <Badge variant="outline" className="text-[10px] border-emerald-500/30 text-emerald-400">
                    Gratis
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    De pago
                  </Badge>
                )}
              </div>
              <p className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{meta.note}</p>
              <p className="mt-1.5 text-[11px]">
                {available ? (
                  <span className="text-emerald-400 inline-flex items-center gap-1">
                    <Check className="h-3 w-3" /> {meta.envKey} configurada
                  </span>
                ) : (
                  <span className="text-amber-400 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Falta {meta.envKey} en .env.local
                  </span>
                )}
              </p>
            </div>
          );
        })}
      </div>

      {/* Anthropic model selection */}
      <AnthropicModelSettings
        model={anthropicModel}
        setModel={setAnthropicModel}
        available={keyAvailability.anthropic}
      />

      {/* Per-module provider selection */}
      <section className="space-y-3">
        <h3 className="text-sm font-semibold text-foreground">Proveedor por módulo</h3>
        <div className="space-y-3">
          {AI_MODULES.map((m) => (
            <ModuleRow
              key={m.id}
              moduleId={m.id}
              label={m.label}
              description={m.description}
              provider={providers[m.id]}
              anthropicModel={anthropicModel}
              keyAvailability={keyAvailability}
              onChange={(provider) => setProvider(m.id, provider)}
            />
          ))}
        </div>
      </section>
    </div>
  );
}

// ─── Anthropic model selection ─────────────────────────────────────────────────

function AnthropicModelSettings({
  model,
  setModel,
  available,
}: {
  model: AnthropicModel;
  setModel: (model: AnthropicModel) => void;
  available: boolean;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingTo, setSavingTo] = useState<AnthropicModel | null>(null);

  function select(next: AnthropicModel) {
    if (next === model || pending) return;
    const previous = model;
    setError(null);
    setSavingTo(next);
    setModel(next); // optimistic
    startTransition(async () => {
      const result = await setAnthropicModelAction(next);
      if (!result.ok) {
        setModel(previous); // revert
        setError(result.error);
      }
      setSavingTo(null);
    });
  }

  return (
    <section className="space-y-3">
      <div>
        <h3 className="text-sm font-semibold text-foreground">Modelo de Claude (Anthropic)</h3>
        <p className="text-xs text-muted-foreground">
          Modelo usado por todos los módulos configurados con Anthropic.
        </p>
      </div>
      <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
        {ANTHROPIC_MODELS.map((m) => {
          const active = model === m.id;
          const isSaving = pending && savingTo === m.id;
          return (
            <button
              key={m.id}
              type="button"
              onClick={() => select(m.id)}
              disabled={pending || !available}
              className={cn(
                "flex flex-col items-start rounded-md border p-2.5 text-left transition-colors disabled:opacity-60",
                active
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-border bg-background/40 hover:border-indigo-500/40"
              )}
            >
              <span className="flex w-full items-center justify-between gap-1.5">
                <span className="text-xs font-medium text-foreground inline-flex items-center gap-1.5">
                  <Bot className="h-3.5 w-3.5" />
                  {m.label}
                </span>
                {isSaving ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                ) : active ? (
                  <Check className="h-3.5 w-3.5 text-indigo-400" />
                ) : null}
              </span>
              <span className="mt-0.5 text-[11px] text-muted-foreground leading-relaxed">{m.note}</span>
            </button>
          );
        })}
      </div>
      {!available && (
        <p className="text-[11px] text-amber-400 inline-flex items-center gap-1">
          <AlertTriangle className="h-3 w-3" /> Falta ANTHROPIC_API_KEY
        </p>
      )}
      {error && <p className="text-xs text-rose-400">{error}</p>}
    </section>
  );
}

// ─── Module row ────────────────────────────────────────────────────────────────

function ModuleRow({
  moduleId,
  label,
  description,
  provider,
  anthropicModel,
  keyAvailability,
  onChange,
}: {
  moduleId: AiModuleId;
  label: string;
  description: string;
  provider: AiProvider;
  anthropicModel: AnthropicModel;
  keyAvailability: Record<AiProvider, boolean>;
  onChange: (provider: AiProvider) => void;
}) {
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const [savingTo, setSavingTo] = useState<AiProvider | null>(null);

  function select(next: AiProvider) {
    if (next === provider || pending) return;
    const previous = provider;
    setError(null);
    setSavingTo(next);
    onChange(next); // optimistic
    startTransition(async () => {
      const result = await setModuleProviderAction(moduleId, next);
      if (!result.ok) {
        onChange(previous); // revert
        setError(result.error);
      }
      setSavingTo(null);
    });
  }

  return (
    <Card className="border-border">
      <CardContent className="p-3.5 space-y-2.5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground">{label}</p>
            <p className="text-xs text-muted-foreground leading-relaxed mt-0.5">{description}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {AI_PROVIDERS.map((p) => {
            const meta = PROVIDER_META[p];
            const active = provider === p;
            const missingKey = !keyAvailability[p];
            const isSaving = pending && savingTo === p;
            return (
              <button
                key={p}
                type="button"
                onClick={() => select(p)}
                disabled={pending}
                className={cn(
                  "flex flex-col items-start rounded-md border p-2.5 text-left transition-colors disabled:opacity-60",
                  active
                    ? "border-indigo-500 bg-indigo-500/10"
                    : "border-border bg-background/40 hover:border-indigo-500/40"
                )}
              >
                <span className="flex w-full items-center justify-between gap-1.5">
                  <span className="text-xs font-medium text-foreground inline-flex items-center gap-1.5">
                    {PROVIDER_ICON[p]}
                    {meta.label}
                  </span>
                  {isSaving ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin text-indigo-400" />
                  ) : active ? (
                    <Check className="h-3.5 w-3.5 text-indigo-400" />
                  ) : null}
                </span>
                <span className="mt-0.5 text-[11px] text-muted-foreground">
                  {providerModelLabel(p, anthropicModel)}
                  {meta.free ? " · gratis" : ""}
                </span>
                {active && missingKey && (
                  <span className="mt-1 text-[10px] text-amber-400 inline-flex items-center gap-1">
                    <AlertTriangle className="h-3 w-3" /> Falta {meta.envKey}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {error && <p className="text-xs text-rose-400">{error}</p>}
      </CardContent>
    </Card>
  );
}
