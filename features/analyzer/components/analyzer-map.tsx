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
import type { PlaceSummary, PlaceLocation } from "@/features/analyzer/types";

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
  return (
    <MapContainer
      center={DEFAULT_CENTER}
      zoom={DEFAULT_ZOOM}
      style={{ height: "100%", width: "100%" }}
      zoomControl
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
        url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
      />

      <MapController center={center} />
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
        return (
          <CircleMarker
            key={place.placeId}
            center={[place.location.latitude, place.location.longitude]}
            radius={selected ? 10 : 7}
            pathOptions={{
              color: selected ? "#6366f1" : "#ffffff",
              fillColor: selected ? "#6366f1" : "#ffffff",
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
            </Tooltip>
          </CircleMarker>
        );
      })}
    </MapContainer>
  );
}
