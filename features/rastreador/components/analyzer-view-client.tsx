"use client";

// features/rastreador/components/analyzer-view-client.tsx
// Client-only wrapper for AnalyzerView. The view restores its whole session
// from localStorage in lazy useState initializers, so its first client render
// never matches server-rendered HTML — rendering it with ssr:false avoids the
// hydration mismatch (the server can't know the persisted session anyway).

import dynamic from "next/dynamic";
import { Loader2 } from "lucide-react";

const AnalyzerView = dynamic(
  () => import("@/features/rastreador/components/analyzer-view").then((m) => m.AnalyzerView),
  {
    ssr: false,
    loading: () => (
      <div className="flex h-full items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    ),
  }
);

export function AnalyzerViewClient({ disabled }: { disabled?: boolean }) {
  return <AnalyzerView disabled={disabled} />;
}
