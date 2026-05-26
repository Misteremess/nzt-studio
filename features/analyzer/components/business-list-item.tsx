"use client";

// features/analyzer/components/business-list-item.tsx
// Compact card-button for a single business in the results list.

import { Star } from "lucide-react";
import type { PlaceSummary } from "@/features/analyzer/types";
import { formatDistance } from "@/features/analyzer/lib/distance";

interface BusinessListItemProps {
  place: PlaceSummary;
  selected: boolean;
  isLoading: boolean;
  distanceM?: number;
  onClick: () => void;
}

export function BusinessListItem({
  place,
  selected,
  isLoading,
  distanceM,
  onClick,
}: BusinessListItemProps) {
  const isClosed =
    place.businessStatus === "CLOSED_PERMANENTLY" ||
    place.businessStatus === "CLOSED_TEMPORARILY";

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={isLoading}
      className={[
        "w-full text-left px-3 py-2.5 rounded-md transition-colors",
        "border focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring",
        selected
          ? "bg-indigo-500/10 border-indigo-500/30"
          : "border-transparent hover:bg-muted/50",
        isLoading ? "cursor-wait" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="flex items-start justify-between gap-2">
        <p
          className={[
            "text-sm font-medium leading-snug truncate",
            isClosed ? "text-muted-foreground line-through" : "text-foreground",
          ].join(" ")}
        >
          {place.name}
        </p>

        <div className="flex items-center gap-1.5 shrink-0">
          {place.rating !== null && (
            <span className="flex items-center gap-0.5 text-xs text-amber-400">
              <Star className="h-3 w-3 fill-amber-400 stroke-amber-400" />
              {place.rating.toFixed(1)}
            </span>
          )}
          {distanceM != null && (
            <span className="text-xs text-indigo-400/70 tabular-nums">
              {formatDistance(distanceM)}
            </span>
          )}
        </div>
      </div>

      {place.formattedAddress && (
        <p className="mt-0.5 text-xs text-muted-foreground truncate">
          {place.formattedAddress}
        </p>
      )}

      {place.businessStatus === "CLOSED_PERMANENTLY" && (
        <p className="mt-0.5 text-xs text-rose-400/80">Cerrado permanentemente</p>
      )}
      {place.businessStatus === "CLOSED_TEMPORARILY" && (
        <p className="mt-0.5 text-xs text-amber-400/80">Cerrado temporalmente</p>
      )}
    </button>
  );
}
