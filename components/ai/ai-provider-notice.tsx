"use client";

// components/ai/ai-provider-notice.tsx
// Shown at the top of each AI-powered module when the provider currently
// configured for it is a paid one (e.g. Claude/Anthropic), so the user
// doesn't trigger costly generations by accident.

import { AlertTriangle, Loader2 } from "lucide-react";

import { useAnthropicModelControl, useSettings } from "@/components/settings/settings-modal";
import { ANTHROPIC_MODELS, PROVIDER_META, providerModelLabel, type AiModuleId, type AnthropicModel } from "@/lib/ai/types";

export function AiProviderNotice({ moduleId }: { moduleId: AiModuleId }) {
  const { providers, anthropicModel } = useSettings();
  const provider = providers[moduleId];
  const meta = PROVIDER_META[provider];
  const modelControl = useAnthropicModelControl();

  if (meta.free) return null;

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-md border border-amber-500/30 bg-amber-500/10 px-2.5 py-1.5 text-xs text-amber-300">
      <p className="inline-flex flex-1 items-center gap-1.5">
        <AlertTriangle className="h-3 w-3 shrink-0" />
        Este módulo usa <span className="font-semibold">{meta.label}</span> (
        {providerModelLabel(provider, anthropicModel)}), un proveedor de pago. Cada generación con
        IA consume créditos.
      </p>
      {provider === "anthropic" && (
        <AnthropicModelMiniSelect
          model={modelControl.model}
          onChange={modelControl.select}
          pending={modelControl.pending}
        />
      )}
    </div>
  );
}

function AnthropicModelMiniSelect({
  model,
  onChange,
  pending,
}: {
  model: AnthropicModel;
  onChange: (model: AnthropicModel) => void;
  pending: boolean;
}) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5">
      {pending && <Loader2 className="h-3 w-3 animate-spin" />}
      <select
        value={model}
        onChange={(e) => onChange(e.target.value as AnthropicModel)}
        disabled={pending}
        className="rounded-md border border-amber-500/30 bg-background/60 px-1.5 py-1 text-[11px] text-foreground outline-none disabled:opacity-60"
        title="Modelo de Claude para todos los módulos"
      >
        {ANTHROPIC_MODELS.map((m) => (
          <option key={m.id} value={m.id}>
            {m.label}
          </option>
        ))}
      </select>
    </span>
  );
}
