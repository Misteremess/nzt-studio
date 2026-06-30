"use client";

// features/rastreador/components/new-pins-toast.tsx
// Floating notification shown after each search, summarising how many new
// businesses were found (and not seen in a previous search this session).

import { useEffect } from "react";
import { AnimatePresence, motion } from "motion/react";
import { MapPin, Sparkles, X } from "lucide-react";

import type { PlaceSummary } from "@/features/rastreador/types";

const AUTO_DISMISS_MS = 6000;

interface NewPinsToastProps {
  /** Newly discovered places, or an empty array if the search found nothing new. */
  places: PlaceSummary[] | null;
  onDismiss: () => void;
}

export function NewPinsToast({ places, onDismiss }: NewPinsToastProps) {
  useEffect(() => {
    if (!places) return;
    const timer = setTimeout(onDismiss, AUTO_DISMISS_MS);
    return () => clearTimeout(timer);
  }, [places, onDismiss]);

  return (
    <AnimatePresence>
      {places && (
        <motion.div
          role="status"
          className="absolute right-3 top-3 z-[1000] w-72 max-w-[calc(100%-1.5rem)] rounded-lg border border-border bg-card/95 shadow-xl backdrop-blur-sm"
          initial={{ opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -12, scale: 0.97 }}
          transition={{ type: "spring", stiffness: 320, damping: 28 }}
        >
          <div className="flex items-start gap-2.5 p-3">
            <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-primary/10 text-primary">
              {places.length > 0 ? (
                <Sparkles className="h-4 w-4" />
              ) : (
                <MapPin className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              {places.length > 0 ? (
                <>
                  <p className="text-sm font-medium text-foreground">
                    {places.length === 1
                      ? "1 negocio nuevo encontrado"
                      : `${places.length} negocios nuevos encontrados`}
                  </p>
                  <ul className="mt-1 space-y-0.5">
                    {places.slice(0, 4).map((p) => (
                      <li key={p.placeId} className="truncate text-xs text-muted-foreground">
                        {p.name}
                      </li>
                    ))}
                    {places.length > 4 && (
                      <li className="text-xs text-muted-foreground">
                        y {places.length - 4} más...
                      </li>
                    )}
                  </ul>
                </>
              ) : (
                <p className="text-sm text-muted-foreground">
                  Sin negocios nuevos en esta búsqueda.
                </p>
              )}
            </div>
            <button
              onClick={onDismiss}
              aria-label="Cerrar notificación"
              className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
