// app/(private)/rastreador/page.tsx
// Rastreador — Local Business Tracker (Google Places).
// Full-height workspace: Leaflet map + search + signals/opportunities panel.
// All heavy logic lives in server actions (features/rastreador/actions.ts).

import { AnalyzerViewClient } from "@/features/rastreador/components/analyzer-view-client";
import { isPlacesApiEnabled } from "@/features/rastreador/lib/config";

export default function RastreadorPage() {
  // When paused (RASTREADOR_ENABLED != "true") the view shows a banner and
  // every Places call is blocked server-side — no API charges can accrue.
  return <AnalyzerViewClient disabled={!isPlacesApiEnabled()} />;
}
