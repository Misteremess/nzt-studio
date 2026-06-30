"use client";

// components/settings/settings-modal.tsx
// App settings in a modal dialog. Two sections:
//   · Interfaz — light/dark theme + accent color (instant, localStorage)
//   · Inteligencia Artificial — provider per module (persisted to DB)
// Exposes a SettingsProvider + useSettings() so any client component (e.g. the
// header button) can open it.

import { createContext, useCallback, useContext, useEffect, useState, useTransition } from "react";
import { AnimatePresence, motion } from "motion/react";
import { Settings, X, Moon, Sun, Palette, Sparkles, Check, Database, AlertTriangle, Loader2, Trash2 } from "lucide-react";

import { cn } from "@/lib/utils";
import { useTheme } from "@/components/theme/theme-provider";
import { ACCENTS } from "@/lib/theme/theme";
import { ProviderSettings } from "@/features/settings/components/settings-view";
import { resetApplicationDataAction, setAnthropicModelAction } from "@/features/settings/actions";
import type { AiModuleId, AiProvider, AnthropicModel } from "@/lib/ai/types";

// ─── Context ────────────────────────────────────────────────────────────────

interface SettingsContextValue {
  open: () => void;
  close: () => void;
  isOpen: boolean;
  providers: Record<AiModuleId, AiProvider>;
  setProvider: (moduleId: AiModuleId, provider: AiProvider) => void;
  anthropicModel: AnthropicModel;
  setAnthropicModel: (model: AnthropicModel) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

interface ProviderProps {
  initialProviders: Record<AiModuleId, AiProvider>;
  keyAvailability: Record<AiProvider, boolean>;
  initialAnthropicModel: AnthropicModel;
  children: React.ReactNode;
}

export function SettingsProvider({
  initialProviders,
  keyAvailability,
  initialAnthropicModel,
  children,
}: ProviderProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [providers, setProviders] = useState(initialProviders);
  const [anthropicModel, setAnthropicModelState] = useState(initialAnthropicModel);
  const open = useCallback(() => setIsOpen(true), []);
  const close = useCallback(() => setIsOpen(false), []);
  const setProvider = useCallback((moduleId: AiModuleId, provider: AiProvider) => {
    setProviders((prev) => ({ ...prev, [moduleId]: provider }));
  }, []);
  const setAnthropicModel = useCallback((model: AnthropicModel) => {
    setAnthropicModelState(model);
  }, []);

  return (
    <SettingsContext.Provider
      value={{ open, close, isOpen, providers, setProvider, anthropicModel, setAnthropicModel }}
    >
      {children}
      <SettingsModal
        open={isOpen}
        onClose={close}
        providers={providers}
        setProvider={setProvider}
        keyAvailability={keyAvailability}
        anthropicModel={anthropicModel}
        setAnthropicModel={setAnthropicModel}
      />
    </SettingsContext.Provider>
  );
}

export function useSettings(): SettingsContextValue {
  const ctx = useContext(SettingsContext);
  if (!ctx) throw new Error("useSettings must be used within SettingsProvider");
  return ctx;
}

/**
 * Shared control for the global Anthropic model setting: optimistic update +
 * persist to the DB, with revert on failure. Any component (settings modal,
 * per-module selector) can use this and stay in sync via SettingsContext.
 */
export function useAnthropicModelControl() {
  const { anthropicModel, setAnthropicModel } = useSettings();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [savingTo, setSavingTo] = useState<AnthropicModel | null>(null);

  const select = useCallback(
    (next: AnthropicModel) => {
      if (next === anthropicModel || pending) return;
      const previous = anthropicModel;
      setError(null);
      setSavingTo(next);
      setAnthropicModel(next); // optimistic, propagates to all consumers
      startTransition(async () => {
        const result = await setAnthropicModelAction(next);
        if (!result.ok) {
          setAnthropicModel(previous);
          setError(result.error);
        }
        setSavingTo(null);
      });
    },
    [anthropicModel, pending, setAnthropicModel]
  );

  return { model: anthropicModel, select, pending, savingTo, error };
}

// ─── Modal ──────────────────────────────────────────────────────────────────

type Tab = "interface" | "ai" | "data";

function SettingsModal({
  open,
  onClose,
  providers,
  setProvider,
  keyAvailability,
  anthropicModel,
  setAnthropicModel,
}: {
  open: boolean;
  onClose: () => void;
  providers: Record<AiModuleId, AiProvider>;
  setProvider: (moduleId: AiModuleId, provider: AiProvider) => void;
  keyAvailability: Record<AiProvider, boolean>;
  anthropicModel: AnthropicModel;
  setAnthropicModel: (model: AnthropicModel) => void;
}) {
  const [tab, setTab] = useState<Tab>("interface");

  // Close on Escape.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
        >
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

          {/* Panel */}
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label="Ajustes"
            className="relative z-10 flex max-h-[85vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-2xl"
            initial={{ opacity: 0, scale: 0.96, y: 8 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.96, y: 8 }}
            transition={{ type: "spring", stiffness: 320, damping: 28 }}
          >
            {/* Header */}
            <div className="flex items-center justify-between border-b border-border px-5 py-3.5">
              <h2 className="inline-flex items-center gap-2 text-sm font-semibold text-foreground">
                <Settings className="h-4 w-4" />
                Ajustes
              </h2>
              <button
                onClick={onClose}
                className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                aria-label="Cerrar"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 border-b border-border px-3 pt-2">
              <TabButton active={tab === "interface"} onClick={() => setTab("interface")}>
                <Palette className="h-3.5 w-3.5" /> Interfaz
              </TabButton>
              <TabButton active={tab === "ai"} onClick={() => setTab("ai")}>
                <Sparkles className="h-3.5 w-3.5" /> Inteligencia Artificial
              </TabButton>
              <TabButton active={tab === "data"} onClick={() => setTab("data")}>
                <Database className="h-3.5 w-3.5" /> Datos
              </TabButton>
            </div>

            {/* Body */}
            <div className="overflow-y-auto p-5">
              {tab === "interface" ? (
                <InterfaceSettings />
              ) : tab === "ai" ? (
                <ProviderSettings
                  providers={providers}
                  setProvider={setProvider}
                  keyAvailability={keyAvailability}
                  anthropicModel={anthropicModel}
                  setAnthropicModel={setAnthropicModel}
                />
              ) : (
                <DataSettings />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-t-md px-3 py-2 text-xs font-medium transition-colors",
        active
          ? "border-b-2 border-primary text-foreground"
          : "border-b-2 border-transparent text-muted-foreground hover:text-foreground"
      )}
    >
      {children}
    </button>
  );
}

// ─── Interface section ──────────────────────────────────────────────────────

function InterfaceSettings() {
  const { mode, accent, setMode, setAccent } = useTheme();

  return (
    <div className="flex flex-col gap-6">
      {/* Theme mode */}
      <section className="space-y-2.5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Tema</h3>
          <p className="text-xs text-muted-foreground">Aspecto claro u oscuro de la aplicación.</p>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          <ModeCard
            active={mode === "dark"}
            onClick={() => setMode("dark")}
            icon={<Moon className="h-4 w-4" />}
            label="Oscuro"
          />
          <ModeCard
            active={mode === "light"}
            onClick={() => setMode("light")}
            icon={<Sun className="h-4 w-4" />}
            label="Claro"
          />
        </div>
      </section>

      {/* Accent color */}
      <section className="space-y-2.5">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Color de resalto</h3>
          <p className="text-xs text-muted-foreground">
            Color principal de botones, enlaces y elementos activos.
          </p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          {ACCENTS.map((a) => {
            const active = accent === a.id;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => setAccent(a.id)}
                title={a.label}
                aria-label={a.label}
                aria-pressed={active}
                className={cn(
                  "relative h-9 w-9 rounded-full border transition-transform hover:scale-105",
                  active ? "border-foreground" : "border-border"
                )}
                style={{ backgroundColor: a.swatch }}
              >
                {active && (
                  <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow" />
                )}
              </button>
            );
          })}
        </div>
      </section>
    </div>
  );
}

// ─── Data section ───────────────────────────────────────────────────────────

const RESET_PHRASE = "ELIMINAR TODO";

function DataSettings() {
  const [confirming, setConfirming] = useState(false);
  const [confirmText, setConfirmText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleReset() {
    setError(null);
    startTransition(async () => {
      const result = await resetApplicationDataAction(confirmText);
      if (result.ok) {
        try {
          // Drop the persisted Rastreador session so the map starts clean too.
          localStorage.removeItem("rastreador:session:v1");
        } catch {
          // Ignore storage access issues.
        }
        setDone(true);
        setConfirming(false);
        setConfirmText("");
        setTimeout(() => window.location.reload(), 1200);
      } else {
        setError(result.error);
      }
    });
  }

  return (
    <div className="flex flex-col gap-5">
      <p className="text-xs text-muted-foreground">
        Gestiona los datos almacenados en la aplicación.
      </p>

      <section className="space-y-2.5 rounded-lg border border-rose-500/30 bg-rose-500/5 p-4">
        <div className="flex items-start gap-2.5">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-rose-400" />
          <div>
            <h3 className="text-sm font-semibold text-foreground">Restablecer aplicación</h3>
            <p className="mt-1 text-xs text-muted-foreground leading-relaxed">
              Elimina permanentemente todas las empresas, análisis, oportunidades, MVPs,
              propuestas, entregas, correos, agentes, negocios rastreados y cachés generados.
              Los ajustes de IA se conservan. Esta acción no se puede deshacer.
            </p>
          </div>
        </div>

        {!confirming ? (
          <button
            type="button"
            onClick={() => setConfirming(true)}
            className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20"
          >
            <Trash2 className="h-3.5 w-3.5" />
            Restablecer aplicación
          </button>
        ) : (
          <div className="space-y-2">
            <p className="text-xs text-foreground">
              Escribe <span className="font-mono font-semibold">{RESET_PHRASE}</span> para
              confirmar:
            </p>
            <input
              type="text"
              value={confirmText}
              onChange={(e) => setConfirmText(e.target.value)}
              placeholder={RESET_PHRASE}
              autoFocus
              className="w-full rounded-md border border-border bg-background/60 px-2.5 py-1.5 text-xs font-mono text-foreground outline-none focus:border-rose-500/50"
            />
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleReset}
                disabled={confirmText !== RESET_PHRASE || pending}
                className="inline-flex items-center gap-1.5 rounded-md border border-rose-500/40 bg-rose-500/10 px-3 py-1.5 text-xs font-medium text-rose-400 transition-colors hover:bg-rose-500/20 disabled:opacity-40"
              >
                {pending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Trash2 className="h-3.5 w-3.5" />
                )}
                Confirmar borrado
              </button>
              <button
                type="button"
                onClick={() => {
                  setConfirming(false);
                  setConfirmText("");
                  setError(null);
                }}
                disabled={pending}
                className="rounded-md border border-border px-3 py-1.5 text-xs font-medium text-muted-foreground transition-colors hover:bg-accent hover:text-foreground disabled:opacity-40"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}

        {error && <p className="text-xs text-rose-400">{error}</p>}
        {done && (
          <p className="inline-flex items-center gap-1 text-xs text-emerald-400">
            <Check className="h-3.5 w-3.5" /> Aplicación restablecida. Recargando...
          </p>
        )}
      </section>
    </div>
  );
}

function ModeCard({
  active,
  onClick,
  icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: React.ReactNode;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center gap-2.5 rounded-lg border p-3 text-left transition-colors",
        active
          ? "border-primary bg-primary/10 text-foreground"
          : "border-border bg-background/40 text-muted-foreground hover:border-primary/40"
      )}
    >
      <span className={cn(active ? "text-primary" : "")}>{icon}</span>
      <span className="text-sm font-medium">{label}</span>
      {active && <Check className="ml-auto h-4 w-4 text-primary" />}
    </button>
  );
}
