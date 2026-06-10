// lib/ai/action-errors.ts
// Shared mapping from provider errors to a Server Action failure result.
// Used by every AI module's actions so error handling stays consistent across
// providers (Anthropic / Gemini).
import "server-only";

import { AiApiError, MissingApiKeyError } from "@/lib/ai/provider";
import { PROVIDER_META } from "@/lib/ai/types";

export interface AiFailure {
  ok: false;
  error: string;
  errorCode?: string;
}

/**
 * Maps a provider/network error to a user-facing failure. Module-specific parse
 * errors should be handled by the caller BEFORE delegating here.
 */
export function mapAiError(err: unknown, moduleLabel: string, fallback: string): AiFailure {
  if (err instanceof MissingApiKeyError) {
    const meta = PROVIDER_META[err.provider];
    return {
      ok: false,
      error: `Falta la clave ${meta.envKey} (proveedor ${meta.label}) en el servidor. Añádela a .env.local.`,
      errorCode: "NO_API_KEY",
    };
  }
  if (err instanceof AiApiError) {
    const meta = PROVIDER_META[err.provider];
    if (err.status === 401 || err.status === 403) {
      return { ok: false, error: `Clave de API de ${meta.label} no válida.`, errorCode: "AUTH" };
    }
    if (err.status === 429) {
      return {
        ok: false,
        error: `Límite de uso de ${meta.label} alcanzado. Inténtalo en unos minutos.`,
        errorCode: "RATE_LIMIT",
      };
    }
    return {
      ok: false,
      error: `Error al contactar con ${meta.label}. Inténtalo de nuevo.`,
      errorCode: "API_ERROR",
    };
  }
  console.error(`[${moduleLabel}] Unexpected error`, err);
  return { ok: false, error: fallback, errorCode: "UNKNOWN" };
}
