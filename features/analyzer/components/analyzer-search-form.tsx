"use client";

import { useState, useRef, useEffect } from "react";
import { Search, ChevronDown, MapPin, X, Info } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ANALYZER_CATEGORIES } from "@/features/analyzer/lib/categories";
import { ANALYZER_RADIUS_OPTIONS } from "@/features/analyzer/lib/config";
import type { SearchInput } from "@/features/analyzer/schemas";

interface AnalyzerSearchFormProps {
  onSearch: (input: Omit<SearchInput, "coordinates">) => void;
  isSearching: boolean;
  mapPointActive?: boolean;
  onClearMapPoint?: () => void;
  /** Called immediately when the user changes the radius — keeps the map circle in sync */
  onRadiusChange?: (radiusMeters: number) => void;
}

const MAX_RESULTS_OPTIONS = [5, 10, 20, 50, 100, 200, 300] as const;

const SELECT_CLASS =
  "h-9 w-full rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground " +
  "transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring " +
  "disabled:cursor-not-allowed disabled:opacity-50";

export function AnalyzerSearchForm({
  onSearch,
  isSearching,
  mapPointActive,
  onClearMapPoint,
  onRadiusChange,
}: AnalyzerSearchFormProps) {
  const [locationText, setLocationText] = useState("Madrid");
  const [placeType, setPlaceType] = useState(ANALYZER_CATEGORIES[0].placeType);
  const [radiusMeters, setRadiusMeters] = useState<number>(1000);
  const [maxResults, setMaxResults] = useState<number>(10);
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

  function handleRadiusChange(value: number) {
    setRadiusMeters(value);
    onRadiusChange?.(value);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = locationText.trim();
    if (!trimmed && !mapPointActive) return;
    onSearch({ locationText: trimmed, placeType, radiusMeters, maxResults });
  }

  const canSubmit = !isSearching && (locationText.trim() !== "" || mapPointActive);

  // Estimated API calls: 1 geocode (if no map point) + ceil(maxResults / 20) search pages
  const searchPages = Math.ceil(maxResults / 20);
  const totalCalls = searchPages + (mapPointActive ? 0 : 1);
  const showCostWarning = maxResults >= 10;

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
            onChange={(e) => setLocationText(e.target.value)}
            placeholder={
              mapPointActive
                ? "Ignorado — usando punto del mapa"
                : "Madrid, Calle Mayor, Barcelona..."
            }
            className={`pl-8 ${mapPointActive ? "opacity-50" : ""}`}
            disabled={isSearching}
          />
        </div>
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
                    setPlaceType(cat.placeType);
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

      {/* Radius + Max results — side by side */}
      <div className="grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Radio</label>
          <select
            value={radiusMeters}
            onChange={(e) => handleRadiusChange(Number(e.target.value))}
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

        <div className="space-y-1.5">
          <label className="text-xs font-medium text-muted-foreground">Resultados</label>
          <select
            value={maxResults}
            onChange={(e) => setMaxResults(Number(e.target.value))}
            className={SELECT_CLASS}
            disabled={isSearching}
          >
            {MAX_RESULTS_OPTIONS.map((n) => (
              <option key={n} value={n}>
                {n} negocios
              </option>
            ))}
          </select>
        </div>
      </div>

      <Button type="submit" className="w-full" disabled={!canSubmit}>
        {isSearching ? "Buscando..." : "Buscar negocios"}
      </Button>

      {/* Cost notice — only shown for ≥10 results */}
      {showCostWarning && (
        <div className="flex items-start gap-1.5 rounded-md bg-amber-500/5 border border-amber-500/15 px-2.5 py-2">
          <Info className="h-3 w-3 mt-0.5 shrink-0 text-amber-400/70" />
          <p className="text-[11px] text-amber-400/70 leading-relaxed">
            {searchPages > 1
              ? `${searchPages} páginas · ${totalCalls} llamadas API · Detalles cacheados 7 días`
              : `1 llamada API por búsqueda · 1 adicional por detalle · Detalles cacheados 7 días`}
          </p>
        </div>
      )}
    </form>
  );
}
