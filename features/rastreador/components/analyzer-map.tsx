"use client";

// Leaflet must only run in the browser — always dynamically imported with { ssr: false }.
import "leaflet/dist/leaflet.css";

import { useEffect } from "react";
import {
  MapContainer,
  TileLayer,
  Circle,
  CircleMarker,
  Tooltip,
  useMap,
  useMapEvents,
} from "react-leaflet";
import type { PlaceSummary, PlaceLocation } from "@/features/rastreador/types";
import { useTheme } from "@/components/theme/theme-provider";

interface AnalyzerMapProps {
  places: PlaceSummary[];
  center: PlaceLocation | null;
  radiusMeters: number;
  selectedPlaceId: string | null;
  onSelectPlace: (placeId: string) => void;
  onMapClick?: (lat: number, lng: number) => void;
  clickedPoint?: PlaceLocation | null;
}

const DEFAULT_CENTER: [number, number] = [40.4168, -3.7038]; // Madrid
const DEFAULT_ZOOM = 13;

/** Re-centers the map when geocoded center changes */
function MapController({ center }: { center: PlaceLocation | null }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView([center.latitude, center.longitude], 15, { animate: true });
    }
  }, [center, map]);
  return null;
}

/** Keeps Leaflet's internal size in sync when the container animates/resizes */
function MapResizeHandler() {
  const map = useMap();
  useEffect(() => {
    const container = map.getContainer();
    const observer = new ResizeObserver(() => map.invalidateSize());
    observer.observe(container);
    return () => observer.disconnect();
  }, [map]);
  return null;
}

/** Forwards map clicks to the parent; ignored when clicking on markers */
function MapClickHandler({
  onMapClick,
}: {
  onMapClick: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => onMapClick(e.latlng.lat, e.latlng.lng),
  });
  return null;
}

export default function AnalyzerMap({
  places,
  center,
  radiusMeters,
  selectedPlaceId,
  onSelectPlace,
  onMapClick,
  clickedPoint,
}: AnalyzerMapProps) {
  const { mode } = useTheme();
  const isLight = mode === "light";

  // Theme-aware CARTO basemap — dark tiles go black on light themes, so swap to
  // the light raster set when the app is in light mode.
  const tileUrl = isLight
    ? "https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png"
    : "https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png";

  // Unselected business markers must contrast with the basemap: white dots are
  // invisible on light tiles, so use a dark slate fill there instead.
  const markerColor = isLight ? "#0f172a" : "#ffffff";

  // Color pins by Score NZT (potencial de oportunidad). Places not yet
  // analyzed (score === null) keep the neutral marker color.
  function pinColor(score: number | null): string {
    if (score === null) return markerColor;
    if (score === 0) return "#64748b"; // slate — sin potencial
    if (score <= 2) return "#94a3b8"; // slate claro — potencial bajo
    if (score <= 5) return "#f59e0b"; // amber — potencial medio
    return "#10b981"; // emerald — potencial alto
  }

  return (
    <div className="relative h-full w-full">
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%" }}
      zoomControl
    >
      <TileLayer
        key={isLight ? "light" : "dark"}
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url={tileUrl}
      />

      <MapController center={center} />
      <MapResizeHandler />
      {onMapClick && <MapClickHandler onMapClick={onMapClick} />}

      {/* Clicked-point: geographic radius circle + center dot */}
      {clickedPoint && (
        <>
          {/* Filled radius circle — reflects the radius selected in the form */}
          <Circle
            center={[clickedPoint.latitude, clickedPoint.longitude]}
            radius={radiusMeters}
            pathOptions={{
              color: "#6366f1",
              fillColor: "#6366f1",
              fillOpacity: 0.07,
              weight: 1.5,
              dashArray: "6 4",
            }}
            interactive={false}
          />
          {/* Center dot with label */}
          <CircleMarker
            center={[clickedPoint.latitude, clickedPoint.longitude]}
            radius={5}
            pathOptions={{
              color: "#6366f1",
              fillColor: "#6366f1",
              fillOpacity: 1,
              weight: 1.5,
            }}
            interactive={false}
          >
            <Tooltip permanent direction="top" offset={[0, -14]}>
              📍 Centro de búsqueda
            </Tooltip>
          </CircleMarker>
        </>
      )}

      {/* Business markers */}
      {places.map((place) => {
        const selected = place.placeId === selectedPlaceId;
        const color = selected ? "#6366f1" : pinColor(place.score);
        return (
          <CircleMarker
            key={place.placeId}
            center={[place.location.latitude, place.location.longitude]}
            radius={selected ? 10 : 7}
            pathOptions={{
              color,
              fillColor: color,
              fillOpacity: 1,
              weight: selected ? 2.5 : 1.5,
              opacity: 1,
            }}
            eventHandlers={{
              click: (e) => {
                e.originalEvent.stopPropagation();
                onSelectPlace(place.placeId);
              },
            }}
          >
            <Tooltip direction="top" offset={[0, -10]}>
              {place.name}
              {place.rating !== null ? ` · ${place.rating.toFixed(1)} ★` : ""}
              {place.score !== null ? ` · Score ${place.score}/9` : ""}
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>

      {/* Legend — color = potencial de oportunidad para negocios analizados */}
      <div className="pointer-events-none absolute bottom-2 left-2 z-[1000] rounded-md border border-border/60 bg-background/85 px-2 py-1.5 text-[10px] text-muted-foreground backdrop-blur-sm">
        <p className="mb-1 font-medium text-foreground/80">Potencial de oportunidad</p>
        <div className="flex flex-col gap-0.5">
          <LegendRow color="#10b981" label="Alto" />
          <LegendRow color="#f59e0b" label="Medio" />
          <LegendRow color="#94a3b8" label="Bajo / nulo" />
          <LegendRow color={markerColor} label="Sin analizar" />
        </div>
      </div>
    </div>
  );
}

function LegendRow({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span
        className="h-2.5 w-2.5 rounded-full border border-border/40"
        style={{ backgroundColor: color }}
      />
      <span>{label}</span>
    </div>
  );
}
