"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { STATUS_CONFIG, ALL_STATUSES } from "@/features/companies/lib/status";
import type { FilterOptions } from "@/features/companies/data";

interface CompaniesFiltersProps {
  filterOptions: FilterOptions;
}

const SELECT_CLASS =
  "h-9 rounded-md border border-input bg-card px-3 py-1 text-sm text-foreground transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring";

export function CompaniesFilters({ filterOptions }: CompaniesFiltersProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const [, startTransition] = useTransition();

  // Initialized from URL on mount; clearAll() resets it explicitly.
  // Back/forward sync is handled by the Server Component re-rendering the page.
  const [searchValue, setSearchValue] = useState(searchParams.get("q") ?? "");

  // Always use the latest searchParams in the debounce callback
  const searchParamsRef = useRef(searchParams);
  useEffect(() => {
    searchParamsRef.current = searchParams;
  }, [searchParams]);

  // Debounce: push search value to URL 350 ms after the user stops typing
  useEffect(() => {
    const timer = setTimeout(() => {
      const params = new URLSearchParams(searchParamsRef.current.toString());
      if (searchValue) params.set("q", searchValue);
      else params.delete("q");
      params.delete("page");
      startTransition(() => {
        router.push(`${pathname}?${params.toString()}`);
      });
    }, 350);
    return () => clearTimeout(timer);
  }, [searchValue]); // eslint-disable-line react-hooks/exhaustive-deps

  function updateFilter(key: string, value: string) {
    const params = new URLSearchParams(searchParams.toString());
    if (value) params.set(key, value);
    else params.delete(key);
    params.delete("page");
    startTransition(() => {
      router.push(`${pathname}?${params.toString()}`);
    });
  }

  function clearAll() {
    setSearchValue("");
    startTransition(() => {
      router.push(pathname);
    });
  }

  const hasFilters =
    searchValue !== "" ||
    (searchParams.get("status") ?? "") !== "" ||
    (searchParams.get("sector") ?? "") !== "" ||
    (searchParams.get("city") ?? "") !== "";

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative flex-1 min-w-48 max-w-sm">
        <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground pointer-events-none" />
        <Input
          value={searchValue}
          onChange={(e) => setSearchValue(e.target.value)}
          placeholder="Buscar empresa..."
          className="pl-8"
        />
      </div>

      <select
        value={searchParams.get("status") ?? ""}
        onChange={(e) => updateFilter("status", e.target.value)}
        className={SELECT_CLASS}
      >
        <option value="">Todos los estados</option>
        {ALL_STATUSES.map((s) => (
          <option key={s} value={s}>
            {STATUS_CONFIG[s].label}
          </option>
        ))}
      </select>

      {filterOptions.sectors.length > 0 && (
        <select
          value={searchParams.get("sector") ?? ""}
          onChange={(e) => updateFilter("sector", e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Todos los sectores</option>
          {filterOptions.sectors.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </select>
      )}

      {filterOptions.cities.length > 0 && (
        <select
          value={searchParams.get("city") ?? ""}
          onChange={(e) => updateFilter("city", e.target.value)}
          className={SELECT_CLASS}
        >
          <option value="">Todas las ciudades</option>
          {filterOptions.cities.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      )}

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          Limpiar filtros
        </Button>
      )}
    </div>
  );
}
