"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, MapPin, X, Info, LocateFixed, Loader2 } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ANALYZER_CATEGORIES } from "@/features/rastreador/lib/categories";
import { ANALYZER_RADIUS_OPTIONS } from "@/features/rastreador/lib/constants";

export interface SearchFormValues {
  locationText: string;
  placeType: string;
  radiusMeters: number;
}

interface AnalyzerSearchFormProps {
  values: SearchFormValues;
  onChange: (patch: Partial<SearchFormValues>) => void;
  onSearch: () => void;
  isSearching: boolean;
  mapPointActive?: boolean;
  onClearMapPoint?: () => void;
  onUseMyLocation?: () => void;
  isLocating?: boolean;
  locationError?: string | null;
}

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground " +
  "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function AnalyzerSearchForm({
  values,
  onChange,
  onSearch,
  isSearching,
  mapPointActive,
  onClearMapPoint,
  onUseMyLocation,
  isLocating,
  locationError,
}: AnalyzerSearchFormProps) {
  const { locationText, placeType, radiusMeters } = values;
  const [categoryOpen, setCategoryOpen] = useState(false);

  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close category dropdown on outside click
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setCategoryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  const selectedCategory =
    ANALYZER_CATEGORIES.find((c) => c.placeType === placeType) ?? ANALYZER_CATEGORIES[0];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!locationText.trim() && !mapPointActive) return;
    onSearch();
  }

  const canSubmit = !isSearching && (locationText.trim() !== "" || mapPointActive);

  const showLargeAreaWarning = radiusMeters >= 2500;

  return (
    <form onSubmit={handleSubmit} className="space-y-3">

      {/* Map point badge */}
      {mapPointActive && (
        <div className="flex items-center gap-1.5 rounded-md bg-indigo-500/10 border border-indigo-500/25 px-2.5 py-1.5">
          <MapPin className="h-3 w-3 text-indigo-400 shrink-0" />
          <span className="text-xs text-indigo-300 flex-1">Punto del mapa activo</span>
          <button
            type="button"
            onClick={onClearMapPoint}
            className="text-indigo-400/60 hover:text-indigo-300 transition-colors"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Location text */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          {mapPointActive ? "Ubicación de texto (opcional)" : "Ubicación"}
        </label>
        <div className="relative">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
          <Input
            value={locationText}
            onChange={(e) => onChange({ locationText: e.target.value })}
            placeholder={
              mapPointActive
                ? "Ignorado — usando punto del mapa"
                : "Madrid, Calle Mayor, Barcelona..."
            }
            className={`pl-8 ${mapPointActive ? "opacity-50" : ""}`}
            disabled={isSearching}
          />
        </div>
        {onUseMyLocation && (
          <button
            type="button"
            onClick={onUseMyLocation}
            disabled={isLocating || isSearching}
            className="inline-flex items-center gap-1.5 text-xs font-medium text-primary transition-colors hover:text-primary/80 disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLocating ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : (
              <LocateFixed className="h-3 w-3" />
            )}
            {isLocating ? "Localizando..." : "Usar mi ubicación"}
          </button>
        )}
        {locationError && (
          <p className="text-[11px] text-rose-400">{locationError}</p>
        )}
      </div>

      {/* Category dropdown with icon */}
      <div className="space-y-1.5" ref={dropdownRef}>
        <label className="text-xs font-medium text-muted-foreground">Categoría</label>
        <div className="relative">
          <button
            type="button"
            onClick={() => setCategoryOpen((o) => !o)}
            disabled={isSearching}
            className={[
              "h-9 w-full rounded-md border border-input bg-card px-3 py-1",
              "flex items-center gap-2 text-sm text-foreground text-left",
              "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
              "disabled:cursor-not-allowed disabled:opacity-50",
            ].join(" ")}
          >
            <span className="text-base leading-none">{selectedCategory.icon}</span>
            <span className="flex-1 truncate">{selectedCategory.label}</span>
            <ChevronDown
              className={`h-4 w-4 text-muted-foreground shrink-0 transition-transform ${
                categoryOpen ? "rotate-180" : ""
              }`}
            />
          </button>

          {categoryOpen && (
            <div className="absolute top-full left-0 right-0 z-50 mt-1 rounded-md border border-border bg-card shadow-xl max-h-56 overflow-y-auto">
              {ANALYZER_CATEGORIES.map((cat) => (
                <button
                  key={cat.placeType}
                  type="button"
                  onClick={() => {
                    onChange({ placeType: cat.placeType });
                    setCategoryOpen(false);
                  }}
                  className={[
                    "flex items-center gap-2.5 w-full px-3 py-2 text-sm text-left transition-colors",
                    cat.placeType === placeType
                      ? "bg-indigo-500/15 text-indigo-300"
                      : "text-foreground hover:bg-muted/50",
                  ].join(" ")}
                >
                  <span className="text-base leading-none w-5 text-center">{cat.icon}</span>
                  <span>{cat.label}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Radius */}
      <div className="space-y-1.5">
        <label className="text-xs font-medium text-muted-foreground">Radio de búsqueda</label>
        <select
          value={radiusMeters}
          onChange={(e) => onChange({ radiusMeters: Number(e.target.value) })}
          className={SELECT_CLASS}
          disabled={isSearching}
        >
          {ANALYZER_RADIUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </div>

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {isSearching ? "Buscando..." : "Buscar negocios"}
      </Button>

      {/* Large area notice */}
      {showLargeAreaWarning && (
        <div className="flex items-start gap-1.5 rounded-md bg-amber-500/5 border border-amber-500/15 px-2.5 py-2">
          <Info className="h-3 w-3 mt-0.5 shrink-0 text-amber-400/70" />
          <p className="text-[11px] text-amber-400/70 leading-relaxed">
            Radio ≥ 2,5 km — la búsqueda puede tardar más y generar varias llamadas a la API.
          </p>
        </div>
      )}
    </form>
  );
}
