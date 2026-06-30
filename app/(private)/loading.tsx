// app/(private)/loading.tsx
// Shown by Next.js while a private route segment is loading (e.g. switching
// modules from the sidebar), so navigation always gives visual feedback
// instead of a blank/frozen screen.

import { Loader2 } from "lucide-react";

export default function PrivateLoading() {
  return (
    <div className="flex h-full w-full items-center justify-center">
      <div className="flex flex-col items-center gap-3 text-muted-foreground">
        <Loader2 className="h-6 w-6 animate-spin" />
        <p className="text-sm">Cargando módulo...</p>
      </div>
    </div>
  );
}
