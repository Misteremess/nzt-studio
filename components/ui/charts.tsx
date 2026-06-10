"use client";

// components/ui/charts.tsx
// Dependency-free, responsive chart primitives styled with the design tokens.
// All charts scale to their container width via SVG viewBox + w-full, and use
// CSS variables so they adapt to theme (light/dark) and the accent color.

import { cn } from "@/lib/utils";

// Shared palette — tuned to read well in both themes.
export const CHART_COLORS = [
  "hsl(var(--primary))",
  "#34d399", // emerald
  "#fbbf24", // amber
  "#f472b6", // pink
  "#60a5fa", // blue
  "#a78bfa", // violet
  "#22d3ee", // cyan
  "#fb7185", // rose
];

function colorAt(i: number) {
  return CHART_COLORS[i % CHART_COLORS.length];
}

// ─── Horizontal bar list ──────────────────────────────────────────────────────
// Best for category rankings (top businesses, sectors, themes…).

export interface BarDatum {
  label: string;
  value: number;
  hint?: string;
  color?: string;
}

export function BarList({
  data,
  valueFormat = (v) => String(v),
  className,
}: {
  data: BarDatum[];
  valueFormat?: (v: number) => string;
  className?: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("space-y-2", className)}>
      {data.map((d, i) => (
        <div key={`${d.label}-${i}`} className="space-y-1">
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="truncate text-foreground" title={d.hint ?? d.label}>
              {d.label}
            </span>
            <span className="shrink-0 font-medium tabular-nums text-muted-foreground">
              {valueFormat(d.value)}
            </span>
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-muted">
            <div
              className="h-full rounded-full transition-all"
              style={{
                width: `${(d.value / max) * 100}%`,
                backgroundColor: d.color ?? colorAt(i),
              }}
            />
          </div>
        </div>
      ))}
      {data.length === 0 && (
        <p className="py-4 text-center text-xs text-muted-foreground">Sin datos</p>
      )}
    </div>
  );
}

// ─── Donut / ring chart ───────────────────────────────────────────────────────

export interface DonutSlice {
  label: string;
  value: number;
  color?: string;
}

export function Donut({
  data,
  size = 160,
  thickness = 22,
  centerLabel,
  centerValue,
  className,
}: {
  data: DonutSlice[];
  size?: number;
  thickness?: number;
  centerLabel?: string;
  centerValue?: string | number;
  className?: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  const radius = (size - thickness) / 2;
  const circ = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className={cn("flex flex-col items-center gap-3 sm:flex-row sm:items-center", className)}>
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="-rotate-90">
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="hsl(var(--muted))"
            strokeWidth={thickness}
          />
          {total > 0 &&
            data.map((d, i) => {
              const frac = d.value / total;
              const len = frac * circ;
              const seg = (
                <circle
                  key={`${d.label}-${i}`}
                  cx={size / 2}
                  cy={size / 2}
                  r={radius}
                  fill="none"
                  stroke={d.color ?? colorAt(i)}
                  strokeWidth={thickness}
                  strokeDasharray={`${len} ${circ - len}`}
                  strokeDashoffset={-offset}
                  strokeLinecap="butt"
                />
              );
              offset += len;
              return seg;
            })}
        </svg>
        {(centerValue !== undefined || centerLabel) && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {centerValue !== undefined && (
              <span className="text-xl font-semibold tabular-nums text-foreground">
                {centerValue}
              </span>
            )}
            {centerLabel && (
              <span className="text-[10px] text-muted-foreground">{centerLabel}</span>
            )}
          </div>
        )}
      </div>
      <div className="grid w-full gap-1.5">
        {data.map((d, i) => (
          <div key={`${d.label}-${i}`} className="flex items-center gap-2 text-xs">
            <span
              className="h-2.5 w-2.5 shrink-0 rounded-sm"
              style={{ backgroundColor: d.color ?? colorAt(i) }}
            />
            <span className="flex-1 truncate text-muted-foreground">{d.label}</span>
            <span className="font-medium tabular-nums text-foreground">{d.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Area / line chart over time ──────────────────────────────────────────────

export interface SeriesPoint {
  label: string;
  value: number;
}

export function AreaChart({
  data,
  height = 120,
  color = "hsl(var(--primary))",
  className,
}: {
  data: SeriesPoint[];
  height?: number;
  color?: string;
  className?: string;
}) {
  const width = 600; // viewBox units; scales to container
  const pad = 4;
  const max = Math.max(1, ...data.map((d) => d.value));
  const n = data.length;

  if (n === 0) {
    return (
      <p className={cn("py-8 text-center text-xs text-muted-foreground", className)}>Sin datos</p>
    );
  }

  const x = (i: number) => (n === 1 ? width / 2 : pad + (i * (width - pad * 2)) / (n - 1));
  const y = (v: number) => height - pad - (v / max) * (height - pad * 2);

  const line = data.map((d, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(d.value)}`).join(" ");
  const area = `${line} L ${x(n - 1)} ${height - pad} L ${x(0)} ${height - pad} Z`;
  const gradId = `area-grad-${Math.round(max)}-${n}`;

  return (
    <div className={className}>
      <svg
        viewBox={`0 0 ${width} ${height}`}
        preserveAspectRatio="none"
        className="h-auto w-full"
        style={{ height }}
      >
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.28" />
            <stop offset="100%" stopColor={color} stopOpacity="0" />
          </linearGradient>
        </defs>
        <path d={area} fill={`url(#${gradId})`} />
        <path d={line} fill="none" stroke={color} strokeWidth={2} vectorEffect="non-scaling-stroke" />
        {data.map((d, i) => (
          <circle key={i} cx={x(i)} cy={y(d.value)} r={2.5} fill={color} />
        ))}
      </svg>
      <div className="mt-1 flex justify-between text-[10px] text-muted-foreground">
        <span>{data[0]?.label}</span>
        {n > 2 && <span>{data[Math.floor(n / 2)]?.label}</span>}
        <span>{data[n - 1]?.label}</span>
      </div>
    </div>
  );
}

// ─── Funnel (vertical stacked stages) ─────────────────────────────────────────

export interface FunnelStage {
  label: string;
  value: number;
  color?: string;
}

export function Funnel({ data, className }: { data: FunnelStage[]; className?: string }) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <div className={cn("space-y-1.5", className)}>
      {data.map((d, i) => {
        const pct = (d.value / max) * 100;
        const conv = i > 0 && data[i - 1].value > 0 ? (d.value / data[i - 1].value) * 100 : null;
        return (
          <div key={d.label} className="flex items-center gap-3">
            <span className="w-28 shrink-0 truncate text-xs text-muted-foreground" title={d.label}>
              {d.label}
            </span>
            <div className="flex h-7 flex-1 items-center">
              <div
                className="flex h-full min-w-[2.5rem] items-center justify-end rounded-md px-2 text-xs font-medium text-white transition-all"
                style={{
                  width: `${Math.max(pct, 6)}%`,
                  backgroundColor: d.color ?? colorAt(i),
                }}
              >
                {d.value}
              </div>
              {conv !== null && (
                <span className="ml-2 text-[10px] tabular-nums text-muted-foreground">
                  {conv.toFixed(0)}%
                </span>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Stat / KPI card ──────────────────────────────────────────────────────────

export function StatTile({
  label,
  value,
  sub,
  icon,
  accent,
  className,
}: {
  label: string;
  value: string | number;
  sub?: string;
  icon?: React.ReactNode;
  accent?: string;
  className?: string;
}) {
  return (
    <div className={cn("rounded-lg border border-border bg-card p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        {icon && <span className="text-muted-foreground">{icon}</span>}
      </div>
      <p
        className="mt-2 text-2xl font-semibold leading-none tabular-nums"
        style={{ color: accent ?? "hsl(var(--foreground))" }}
      >
        {value}
      </p>
      {sub && <p className="mt-1.5 text-[11px] text-muted-foreground">{sub}</p>}
    </div>
  );
}
