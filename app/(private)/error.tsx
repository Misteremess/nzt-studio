"use client";

import { useEffect } from "react";

export default function PrivateError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] gap-4 text-center px-4">
      <h2 className="text-xl font-semibold text-zinc-100">Algo salió mal</h2>
      <p className="text-zinc-400 text-sm max-w-md">
        Se produjo un error inesperado. Puedes intentar recargar o volver al inicio.
      </p>
      <button
        onClick={reset}
        className="px-4 py-2 text-sm rounded-md bg-indigo-600 hover:bg-indigo-500 text-white transition-colors"
      >
        Reintentar
      </button>
    </div>
  );
}
