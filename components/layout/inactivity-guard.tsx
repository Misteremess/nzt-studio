"use client";

import { signOut } from "next-auth/react";
import { useInactivityTimeout } from "@/lib/hooks/use-inactivity-timeout";

export function InactivityGuard() {
  const { warning, resetTimer } = useInactivityTimeout(
    30 * 60 * 1000,
    28 * 60 * 1000
  );

  if (!warning) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-3 rounded-lg border border-amber-500/30 bg-zinc-900/95 px-4 py-3 shadow-xl backdrop-blur-sm">
      <div className="text-sm text-amber-300/90 leading-snug">
        Tu sesión expira en{" "}
        <span className="font-semibold">2 minutos</span> por inactividad.
      </div>
      <div className="flex items-center gap-2 shrink-0">
        <button
          type="button"
          onClick={resetTimer}
          className="rounded-md bg-indigo-500/20 border border-indigo-500/30 px-3 py-1.5 text-xs font-medium text-indigo-300 hover:bg-indigo-500/30 transition-colors"
        >
          Mantener sesión
        </button>
        <button
          type="button"
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="rounded-md px-3 py-1.5 text-xs font-medium text-zinc-400 hover:text-zinc-200 transition-colors"
        >
          Cerrar sesión
        </button>
      </div>
    </div>
  );
}
