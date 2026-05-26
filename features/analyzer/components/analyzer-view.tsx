"use client";

// features/analyzer/components/analyzer-view.tsx
// Root client component for the Local Business Analyzer.
// Owns all UI state and orchestrates the three server actions.

import dynamic from "next/dynamic";
import { useState, useTransition } from "react";
import { Loader2, MapPin } from "lucide-react";

import { Card, CardContent } from "@/components/ui/card";
import { AnalyzerSearchForm } from "@/features/analyzer/components/analyzer-search-form";
import { BusinessListItem } from "@/features/analyzer/components/business-list-item";
import { BusinessDetailPanel } from "@/features/analyzer/components/business-detail-panel";
import {
  searchPlacesAction,
  fetchPlaceDetailAction,
  saveAsCompanyAction,
} from "@/features/analyzer/actions";
import { haversineDistance } from "@/features/analyzer/lib/distance";

import type {
  PlaceSummary,
  PlaceDetail,
  PlaceSignals,
  DetectedOpportunity,
  PlaceLocation,
} from "@/features/analyzer/types";
import type { SearchInput } from "@/features/analyzer/schemas";

type PlaceWithDist = PlaceSummary & { distanceM: number };

// Leaflet must never run on the server — always lazy-load with ssr:false.
const AnalyzerMap = dynamic(
  () => import("@/features/analyzer/components/analyzer-map"),
  { ssr: false, loading: () => <div className="h-full bg-muted/20 animate-pulse rounded-lg" /> }
);

// ─── Component ────────────────────────────────────────────────────────────────

export function AnalyzerView() {
  // ── Search state ──────────────────────────────────────────────────────────
  const [hasSearched, setHasSearched] = useState(false);
  const [places, setPlaces] = useState<PlaceWithDist[]>([]);
  const [center, setCenter] = useState<PlaceLocation | null>(null);
  const [radiusMeters, setRadiusMeters] = useState<number>(1000);
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

  // ── Save state ────────────────────────────────────────────────────────────
  const [savedCompanyId, setSavedCompanyId] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);

  // ── Transitions ───────────────────────────────────────────────────────────
  const [isSearching, startSearch] = useTransition();
  const [isLoadingDetail, startLoadDetail] = useTransition();
  const [isSaving, startSave] = useTransition();

  // ── Handlers ──────────────────────────────────────────────────────────────

  function handleSearch(formValues: Omit<SearchInput, "coordinates">) {
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

    // Merge form values with clicked map point — coordinates skip geocoding server-side
    const payload = {
      ...formValues,
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
        setRadiusMeters(result.data.radiusMeters);
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

    startLoadDetail(async () => {
      const result = await fetchPlaceDetailAction(placeId);
      if (result.ok) {
        setDetail(result.data.detail);
        setSignals(result.data.signals);
        setOpportunities(result.data.opportunities);
        setFromCache(result.data.fromCache);
        setCompanyId(result.data.companyId);
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
              onSearch={handleSearch}
              isSearching={isSearching}
              mapPointActive={clickedPoint !== null}
              onClearMapPoint={handleClearMapPoint}
              onRadiusChange={setRadiusMeters}
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
        {/* Map — fixed height, always visible */}
        <div className="h-72 shrink-0 rounded-lg overflow-hidden border border-border">
          <AnalyzerMap
            places={places}
            center={center}
            radiusMeters={radiusMeters}
            selectedPlaceId={selectedPlaceId}
            onSelectPlace={handleSelectPlace}
            onMapClick={handleMapClick}
            clickedPoint={clickedPoint}
          />
        </div>

        {/* Detail panel — takes remaining height, scrolls internally */}
        {selectedPlaceId ? (
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
                />
              ) : null}
            </CardContent>
          </Card>
        ) : (
          <div className="flex-1 min-h-0 flex items-center justify-center">
            <div className="text-center text-muted-foreground/40 space-y-2 max-w-xs">
              <MapPin className="h-10 w-10 mx-auto opacity-40" />
              <p className="text-sm">
                Busca negocios o haz clic en el mapa para fijar el centro de búsqueda.
                Selecciona un negocio para ver su análisis.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
