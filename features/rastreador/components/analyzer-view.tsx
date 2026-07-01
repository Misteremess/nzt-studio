"use client";

// features/rastreador/components/analyzer-view.tsx
// Root client component for the Local Business Tracker (Rastreador).
// Owns all UI state, orchestrates the server actions, and persists the search
// session to localStorage so switching modules, reloading or reopening the
// app restores the last search (map center, pins and selection).

import dynamic from "next/dynamic";
import { useEffect, useRef, useState, useTransition } from "react";
import { Loader2, MapPin } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import {
  AnalyzerSearchForm,
  type SearchFormValues,
} from "@/features/rastreador/components/analyzer-search-form";
import { BusinessListItem } from "@/features/rastreador/components/business-list-item";
import { BusinessDetailPanel } from "@/features/rastreador/components/business-detail-panel";
import { NewPinsToast } from "@/features/rastreador/components/new-pins-toast";
import { ANALYZER_CATEGORIES } from "@/features/rastreador/lib/categories";
import {
  searchPlacesAction,
  fetchPlaceDetailAction,
  refreshPlaceDetailAction,
  saveAsCompanyAction,
  auditPlaceWebsiteAction,
} from "@/features/rastreador/actions";
import { haversineDistance } from "@/features/rastreador/lib/distance";
import { computeScore } from "@/features/rastreador/lib/score";

import type {
  PlaceSummary,
  PlaceDetail,
  PlaceSignals,
  DetectedOpportunity,
  PlaceLocation,
  WebAuditResult,
} from "@/features/rastreador/types";

type PlaceWithDist = PlaceSummary & { distanceM: number };

// Leaflet must never run on the server — always lazy-load with ssr:false.
const AnalyzerMap = dynamic(
  () => import("@/features/rastreador/components/analyzer-map"),
  { ssr: false, loading: () => <div className="h-full bg-muted/20 animate-pulse rounded-lg" /> }
);

const STORAGE_KEY = "rastreador:session:v1";

const DEFAULT_FORM: SearchFormValues = {
  locationText: "Madrid",
  placeType: ANALYZER_CATEGORIES[0].placeType,
  radiusMeters: 1000,
};

interface PersistedSession {
  form: SearchFormValues;
  hasSearched: boolean;
  places: PlaceWithDist[];
  center: PlaceLocation | null;
  clickedPoint: PlaceLocation | null;
  selectedPlaceId: string | null;
  detail: PlaceDetail | null;
  signals: PlaceSignals | null;
  opportunities: DetectedOpportunity[];
  fromCache: boolean;
  companyId: string | null;
  webAudit: WebAuditResult | null;
  detailFetchedAt: string | null;
}

/**
 * Reads the persisted session synchronously, before the first render. Doing
 * this via a lazy useState initializer (rather than restoring inside a
 * useEffect) avoids a render race: an effect-based restore sets state
 * asynchronously, so a save-effect running in the same commit (or React 18
 * Strict Mode's double-invoke in dev) can observe stale defaults and
 * overwrite the saved session with empty data before the restore lands.
 */
function readPersistedSession(): PersistedSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as PersistedSession;
  } catch {
    return null;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyzerView() {
  // Read once, synchronously, on first render — see readPersistedSession().
  const [initialSession] = useState(readPersistedSession);
  const hadSession = initialSession !== null;

  // ── Form state (controlled, persisted) ─────────────────────────────────────
  const [form, setForm] = useState<SearchFormValues>(initialSession?.form ?? DEFAULT_FORM);

  // ── Search state ──────────────────────────────────────────────────────────
  const [hasSearched, setHasSearched] = useState(initialSession?.hasSearched ?? false);
  const [places, setPlaces] = useState<PlaceWithDist[]>(initialSession?.places ?? []);
  const [center, setCenter] = useState<PlaceLocation | null>(initialSession?.center ?? null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ── Map click state ───────────────────────────────────────────────────────
  const [clickedPoint, setClickedPoint] = useState<PlaceLocation | null>(
    initialSession?.clickedPoint ?? null
  );

  // ── Detail state ──────────────────────────────────────────────────────────
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(
    initialSession?.selectedPlaceId ?? null
  );
  const [detail, setDetail] = useState<PlaceDetail | null>(initialSession?.detail ?? null);
  const [signals, setSignals] = useState<PlaceSignals | null>(initialSession?.signals ?? null);
  const [opportunities, setOpportunities] = useState<DetectedOpportunity[]>(
    initialSession?.opportunities ?? []
  );
  const [fromCache, setFromCache] = useState(initialSession?.fromCache ?? false);
  const [companyId, setCompanyId] = useState<string | null>(initialSession?.companyId ?? null);
  const [detailError, setDetailError] = useState<string | null>(null);
  const [detailFetchedAt, setDetailFetchedAt] = useState<string | null>(
    initialSession?.detailFetchedAt ?? null
  );
  const [refreshError, setRefreshError] = useState<string | null>(null);

  // ── Web audit state ───────────────────────────────────────────────────────
  const [webAudit, setWebAudit] = useState<WebAuditResult | null>(initialSession?.webAudit ?? null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // ── Save state ────────────────────────────────────────────────────────────
  const [savedCompanyId, setSavedCompanyId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Geolocation state ─────────────────────────────────────────────────────
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // ── New pins notification ─────────────────────────────────────────────────
  const [newPins, setNewPins] = useState<PlaceSummary[] | null>(null);
  const placesRef = useRef<PlaceWithDist[]>([]);
  useEffect(() => {
    placesRef.current = places;
  }, [places]);

  // ── Transitions ───────────────────────────────────────────────────────────
  const [isSearching, startSearch] = useTransition();
  const [isLoadingDetail, startLoadDetail] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isAuditing, startAudit] = useTransition();
  const [isRefreshingDetail, startRefreshDetail] = useTransition();

  // ── Persistence: geolocate on first visit if nothing was stored ─────────────
  useEffect(() => {
    if (!hadSession && typeof navigator !== "undefined" && navigator.geolocation) {
      // Default the search to the user's current location.
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          const here: PlaceLocation = {
            latitude: pos.coords.latitude,
            longitude: pos.coords.longitude,
          };
          setClickedPoint(here);
          setCenter(here);
        },
        () => {
          // Permission denied / unavailable — keep the Madrid text default.
        },
        { timeout: 8000, maximumAge: 600000 }
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Persistence: save snapshot whenever the session changes ─────────────────
  useEffect(() => {
    const snapshot: PersistedSession = {
      form,
      hasSearched,
      places,
      center,
      clickedPoint,
      selectedPlaceId,
      detail,
      signals,
      opportunities,
      fromCache,
      companyId,
      webAudit,
      detailFetchedAt,
    };
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
    } catch {
      // Quota / serialization issues are non-fatal.
    }
  }, [
    form,
    hasSearched,
    places,
    center,
    clickedPoint,
    selectedPlaceId,
    detail,
    signals,
    opportunities,
    fromCache,
    companyId,
    webAudit,
    detailFetchedAt,
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────────

  /** Updates the cached pin score for a place once its opportunities are known. */
  function updatePlaceScore(placeId: string, opportunities: DetectedOpportunity[]) {
    const score = computeScore(opportunities);
    setPlaces((prev) =>
      prev.map((p) => (p.placeId === placeId ? { ...p, score } : p))
    );
  }

  function handleFormChange(patch: Partial<SearchFormValues>) {
    setForm((prev) => ({ ...prev, ...patch }));
  }

  function handleSearch() {
    setHasSearched(true);
    setSearchError(null);
    setSelectedPlaceId(null);
    setDetail(null);
    setSignals(null);
    setOpportunities([]);
    setCompanyId(null);
    setSavedCompanyId(null);
    setSaveError(null);
    setDetailError(null);
    setWebAudit(null);
    setAuditError(null);

    // Merge form values with clicked map point — coordinates skip geocoding server-side
    const payload = {
      locationText: form.locationText.trim(),
      placeType: form.placeType,
      radiusMeters: form.radiusMeters,
      ...(clickedPoint ? { coordinates: clickedPoint } : {}),
    };

    startSearch(async () => {
      const result = await searchPlacesAction(payload);
      if (result.ok) {
        const newCenter = result.data.center;

        // Merge with previously-found places so pins already discovered stay
        // on the map across searches, then recompute distances from the new
        // center and sort by proximity.
        const prevIds = new Set(placesRef.current.map((p) => p.placeId));
        const freshlyFound = result.data.places.filter((p) => !prevIds.has(p.placeId));
        setNewPins(freshlyFound);

        setPlaces((prev) => {
          const merged = new Map<string, PlaceSummary>(prev.map((p) => [p.placeId, p]));
          for (const p of result.data.places) merged.set(p.placeId, p);

          return Array.from(merged.values())
            .map((p) => ({
              ...p,
              distanceM: haversineDistance(
                newCenter.latitude,
                newCenter.longitude,
                p.location.latitude,
                p.location.longitude
              ),
            }))
            .sort((a, b) => a.distanceM - b.distanceM);
        });
        setCenter(newCenter);
      } else {
        setSearchError(result.error);
        setPlaces([]);
      }
    });
  }

  function handleSelectPlace(placeId: string) {
    if (placeId === selectedPlaceId) return;

    setSelectedPlaceId(placeId);
    setDetail(null);
    setSignals(null);
    setOpportunities([]);
    setCompanyId(null);
    setSavedCompanyId(null);
    setSaveError(null);
    setDetailError(null);
    setWebAudit(null);
    setAuditError(null);
    setDetailFetchedAt(null);
    setRefreshError(null);

    startLoadDetail(async () => {
      const result = await fetchPlaceDetailAction(placeId);
      if (result.ok) {
        setDetail(result.data.detail);
        setSignals(result.data.signals);
        setOpportunities(result.data.opportunities);
        setFromCache(result.data.fromCache);
        setCompanyId(result.data.companyId);
        setWebAudit(result.data.webAudit);
        setDetailFetchedAt(result.data.detailFetchedAt);
        updatePlaceScore(placeId, result.data.opportunities);

        // Auto-audit: si tiene web y no hay auditoría cacheada, lánzala en
        // paralelo — el panel muestra su propio spinner mientras tanto.
        if (result.data.detail.websiteUri && !result.data.webAudit) {
          startAudit(async () => {
            const auditResult = await auditPlaceWebsiteAction(placeId);
            if (auditResult.ok) {
              setWebAudit(auditResult.data.audit);
            } else if (auditResult.errorCode !== "NO_WEBSITE") {
              setAuditError(auditResult.error);
            }
          });
        }
      } else {
        setDetailError(result.error);
      }
    });
  }

  function handleRefreshDetail() {
    if (!selectedPlaceId) return;
    setRefreshError(null);

    startRefreshDetail(async () => {
      const result = await refreshPlaceDetailAction(selectedPlaceId);
      if (result.ok) {
        setDetail(result.data.detail);
        setSignals(result.data.signals);
        setOpportunities(result.data.opportunities);
        setFromCache(result.data.fromCache);
        setCompanyId(result.data.companyId);
        setDetailFetchedAt(result.data.detailFetchedAt);
        updatePlaceScore(selectedPlaceId, result.data.opportunities);

        // Re-audit the website too, since the page may have changed.
        if (result.data.detail.websiteUri) {
          startAudit(async () => {
            const auditResult = await auditPlaceWebsiteAction(selectedPlaceId);
            if (auditResult.ok) {
              setWebAudit(auditResult.data.audit);
            } else if (auditResult.errorCode !== "NO_WEBSITE") {
              setAuditError(auditResult.error);
            }
          });
        } else {
          setWebAudit(null);
        }
      } else {
        setRefreshError(result.error);
      }
    });
  }

  function handleSave() {
    if (!selectedPlaceId) return;
    setSaveError(null);

    startSave(async () => {
      const result = await saveAsCompanyAction(selectedPlaceId);
      if (result.ok) {
        setSavedCompanyId(result.data.companyId);
        setCompanyId(result.data.companyId);
      } else {
        setSaveError(result.error);
      }
    });
  }

  function handleMapClick(lat: number, lng: number) {
    setClickedPoint({ latitude: lat, longitude: lng });
  }

  function handleClearMapPoint() {
    setClickedPoint(null);
  }

  function handleUseMyLocation() {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      setLocationError("La geolocalización no está disponible en este navegador.");
      return;
    }
    setLocationError(null);
    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const here: PlaceLocation = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
        };
        setClickedPoint(here);
        setCenter(here);
        setIsLocating(false);
      },
      (err) => {
        setIsLocating(false);
        setLocationError(
          err.code === err.PERMISSION_DENIED
            ? "Permiso de ubicación denegado. Actívalo en el navegador."
            : "No se pudo obtener tu ubicación."
        );
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
    );
  }

  // ── Render ────────────────────────────────────────────────────────────────
  // overflow-hidden prevents horizontal scroll from Leaflet initialisation.
  // min-h-0 on flex children prevents implicit min-height:auto overflow.
  return (
    <div className="flex gap-4 h-full w-full overflow-hidden">
      {/* ── Left column: search form + results list ────────────────── */}
      <div className="w-80 shrink-0 flex flex-col gap-3 min-h-0">
        <Card>
          <CardContent className="p-4">
            <AnalyzerSearchForm
              values={form}
              onChange={handleFormChange}
              onSearch={handleSearch}
              isSearching={isSearching}
              mapPointActive={clickedPoint !== null}
              onClearMapPoint={handleClearMapPoint}
              onUseMyLocation={handleUseMyLocation}
              isLocating={isLocating}
              locationError={locationError}
            />
          </CardContent>
        </Card>

        {hasSearched && (
          <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <CardContent className="flex-1 min-h-0 overflow-y-auto p-2">
              {isSearching ? (
                <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-sm">Buscando negocios...</span>
                </div>
              ) : searchError ? (
                <p className="text-sm text-rose-400 text-center px-2 py-8">{searchError}</p>
              ) : places.length === 0 ? (
                <div className="flex flex-col items-center justify-center gap-2 py-10 text-muted-foreground">
                  <MapPin className="h-6 w-6 opacity-30" />
                  <p className="text-sm text-center">Sin resultados en esta área.</p>
                </div>
              ) : (
                <div className="space-y-0.5">
                  {places.map((place) => (
                    <BusinessListItem
                      key={place.placeId}
                      place={place}
                      selected={place.placeId === selectedPlaceId}
                      isLoading={isLoadingDetail}
                      distanceM={place.distanceM}
                      onClick={() => handleSelectPlace(place.placeId)}
                    />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        )}
      </div>

      {/* ── Right column: map + detail panel ─────────────────────────── */}
      <div className="flex-1 min-w-0 flex flex-col gap-3 min-h-0">
        {/* Map — fills the column until a business is selected, then shrinks */}
        <div
          style={{ flexBasis: 0 }}
          className={cn(
            "relative min-h-0 rounded-lg overflow-hidden border border-border transition-[flex-grow] duration-500 ease-in-out",
            selectedPlaceId ? "grow-[2]" : "grow-[5]"
          )}
        >
          <NewPinsToast places={newPins} onDismiss={() => setNewPins(null)} />
          <AnalyzerMap
            places={places}
            center={center}
            radiusMeters={form.radiusMeters}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={handleSelectPlace}
            onMapClick={handleMapClick}
            clickedPoint={clickedPoint}
          />
        </div>

        {/* Detail panel — collapsed until a business is selected, then grows in */}
        <div
          style={{ flexBasis: 0 }}
          className={cn(
            "min-h-0 flex flex-col overflow-hidden transition-[flex-grow,opacity] duration-500 ease-in-out",
            selectedPlaceId ? "grow-[3] opacity-100" : "grow-0 opacity-0"
          )}
        >
          {selectedPlaceId && (
            <Card className="flex-1 min-h-0 flex flex-col overflow-hidden">
              <CardContent className="flex-1 min-h-0 overflow-y-auto p-4">
                {isLoadingDetail ? (
                  <div className="flex items-center justify-center gap-2 py-10 text-muted-foreground">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-sm">Cargando detalle...</span>
                  </div>
                ) : detailError ? (
                  <p className="text-sm text-rose-400 text-center py-8">{detailError}</p>
                ) : detail && signals ? (
                  <BusinessDetailPanel
                    detail={detail}
                    signals={signals}
                    opportunities={opportunities}
                    fromCache={fromCache}
                    companyId={companyId}
                    savedCompanyId={savedCompanyId}
                    isSaving={isSaving}
                    onSave={handleSave}
                    saveError={saveError}
                    webAudit={webAudit}
                    isAuditing={isAuditing}
                    auditError={auditError}
                    detailFetchedAt={detailFetchedAt}
                    isRefreshing={isRefreshingDetail}
                    onRefresh={handleRefreshDetail}
                    refreshError={refreshError}
                  />
                ) : null}
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
