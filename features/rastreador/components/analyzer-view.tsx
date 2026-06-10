"use client";

// features/rastreador/components/analyzer-view.tsx
// Root client component for the Local Business Tracker (Rastreador).
// Owns all UI state, orchestrates the server actions, and persists the search
// session to sessionStorage so switching modules and returning restores it.

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
import { ANALYZER_CATEGORIES } from "@/features/rastreador/lib/categories";
import {
  searchPlacesAction,
  fetchPlaceDetailAction,
  saveAsCompanyAction,
  auditPlaceWebsiteAction,
} from "@/features/rastreador/actions";
import { haversineDistance } from "@/features/rastreador/lib/distance";

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
  maxResults: 10,
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
}

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyzerView() {
  // ── Form state (controlled, persisted) ─────────────────────────────────────
  const [form, setForm] = useState<SearchFormValues>(DEFAULT_FORM);

  // ── Search state ──────────────────────────────────────────────────────────
  const [hasSearched, setHasSearched] = useState(false);
  const [places, setPlaces] = useState<PlaceWithDist[]>([]);
  const [center, setCenter] = useState<PlaceLocation | null>(null);
  const [searchError, setSearchError] = useState<string | null>(null);

  // ── Map click state ───────────────────────────────────────────────────────
  const [clickedPoint, setClickedPoint] = useState<PlaceLocation | null>(null);

  // ── Detail state ──────────────────────────────────────────────────────────
  const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
  const [detail, setDetail] = useState<PlaceDetail | null>(null);
  const [signals, setSignals] = useState<PlaceSignals | null>(null);
  const [opportunities, setOpportunities] = useState<DetectedOpportunity[]>([]);
  const [fromCache, setFromCache] = useState(false);
  const [companyId, setCompanyId] = useState<string | null>(null);
  const [detailError, setDetailError] = useState<string | null>(null);

  // ── Web audit state ───────────────────────────────────────────────────────
  const [webAudit, setWebAudit] = useState<WebAuditResult | null>(null);
  const [auditError, setAuditError] = useState<string | null>(null);

  // ── Save state ────────────────────────────────────────────────────────────
  const [savedCompanyId, setSavedCompanyId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Geolocation state ─────────────────────────────────────────────────────
  const [isLocating, setIsLocating] = useState(false);
  const [locationError, setLocationError] = useState<string | null>(null);

  // ── Transitions ───────────────────────────────────────────────────────────
  const [isSearching, startSearch] = useTransition();
  const [isLoadingDetail, startLoadDetail] = useTransition();
  const [isSaving, startSave] = useTransition();
  const [isAuditing, startAudit] = useTransition();

  // ── Persistence: restore on mount, then geolocate if nothing was stored ─────
  const restored = useRef(false);

  useEffect(() => {
    let hadSession = false;
    try {
      const raw = sessionStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as PersistedSession;
        setForm(s.form ?? DEFAULT_FORM);
        setHasSearched(s.hasSearched ?? false);
        setPlaces(s.places ?? []);
        setCenter(s.center ?? null);
        setClickedPoint(s.clickedPoint ?? null);
        setSelectedPlaceId(s.selectedPlaceId ?? null);
        setDetail(s.detail ?? null);
        setSignals(s.signals ?? null);
        setOpportunities(s.opportunities ?? []);
        setFromCache(s.fromCache ?? false);
        setCompanyId(s.companyId ?? null);
        setWebAudit(s.webAudit ?? null);
        hadSession = true;
      }
    } catch {
      // Corrupt snapshot — ignore and start fresh.
    }

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

    restored.current = true;
  }, []);

  // ── Persistence: save snapshot whenever the session changes ─────────────────
  useEffect(() => {
    if (!restored.current) return;
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
    };
    try {
      sessionStorage.setItem(STORAGE_KEY, JSON.stringify(snapshot));
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
  ]);

  // ── Handlers ──────────────────────────────────────────────────────────────

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
      maxResults: form.maxResults,
      ...(clickedPoint ? { coordinates: clickedPoint } : {}),
    };

    startSearch(async () => {
      const result = await searchPlacesAction(payload);
      if (result.ok) {
        const newCenter = result.data.center;
        // Compute haversine distance from center to each result, then sort by proximity
        const sorted: PlaceWithDist[] = result.data.places
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

        setPlaces(sorted);
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

    startLoadDetail(async () => {
      const result = await fetchPlaceDetailAction(placeId);
      if (result.ok) {
        setDetail(result.data.detail);
        setSignals(result.data.signals);
        setOpportunities(result.data.opportunities);
        setFromCache(result.data.fromCache);
        setCompanyId(result.data.companyId);
        setWebAudit(result.data.webAudit);

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
            "min-h-0 rounded-lg overflow-hidden border border-border transition-[flex-grow] duration-500 ease-in-out",
            selectedPlaceId ? "grow-[2]" : "grow-[5]"
          )}
        >
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
