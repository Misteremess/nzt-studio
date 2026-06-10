// app/(private)/rastreador/informe/[placeId]/page.tsx
// Informe de presencia digital de un negocio descubierto con el Rastreador.
// Lee todo desde PlaceCache (sin llamadas a Google Places). Si el negocio
// tiene web y aún no hay auditoría, la ejecuta aquí mismo y la persiste,
// para que el informe siempre salga completo.

import { notFound } from "next/navigation";

import {
  getPlaceCacheByPlaceId,
  updateCacheWebAudit,
} from "@/features/rastreador/lib/place-cache";
import { runWebAudit } from "@/features/rastreador/lib/web-audit";
import { InformeView } from "@/features/rastreador/components/informe-view";
import type {
  PlaceSignals,
  DetectedOpportunity,
  WebAuditResult,
} from "@/features/rastreador/types";

export const metadata = {
  title: "Informe de presencia digital — NZT Studio",
};

function parseJson<T>(value: unknown): T | null {
  if (value === null || value === undefined || typeof value !== "object") return null;
  return value as T;
}

interface InformePageProps {
  params: Promise<{ placeId: string }>;
}

export default async function InformePage({ params }: InformePageProps) {
  const { placeId } = await params;
  const row = await getPlaceCacheByPlaceId(decodeURIComponent(placeId));

  // Sin detalle cargado no hay señales ni oportunidades — informe vacío no sirve
  if (!row || !row.detailFetchedAt) notFound();

  const signals = parseJson<PlaceSignals>(row.signals);
  const opportunities = parseJson<DetectedOpportunity[]>(row.opportunities) ?? [];

  // Auditoría: usa la cacheada o ejecútala ahora si el negocio tiene web
  let webAudit = parseJson<WebAuditResult>(row.webAudit);
  if (!webAudit && row.websiteUri) {
    webAudit = await runWebAudit(row.websiteUri);
    try {
      await updateCacheWebAudit(row.placeId, webAudit);
    } catch {
      // No bloquea el informe: la auditoría ya está en memoria
      console.error("[Rastreador] Web audit persist failed for", row.placeId);
    }
  }

  return (
    <InformeView
      row={row}
      signals={signals}
      opportunities={opportunities}
      webAudit={webAudit}
    />
  );
}
