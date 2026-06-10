import Link from "next/link";
import { cn } from "@/lib/utils";
import { STATUS_CONFIG, ALL_STATUSES } from "@/features/companies/lib/status";
import type { CompanyStats } from "@/features/companies/data";
import type { CompanyStatus } from "@/features/companies/types";

interface CompaniesStatsProps {
  stats: CompanyStats;
  activeStatus?: CompanyStatus;
}

/**
 * CRM pipeline overview: a total tile plus one clickable tile per status that
 * filters the list. Each tile shows its share of the pipeline as a thin bar.
 */
export function CompaniesStats({ stats, activeStatus }: CompaniesStatsProps) {
  if (stats.total === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-6">
      {/* Total */}
      <Link
        href="/companies"
        className={cn(
          "rounded-lg border bg-card p-3 transition-colors hover:border-primary/40",
          !activeStatus ? "border-primary/60" : "border-border"
        )}
      >
        <p className="text-[11px] uppercase tracking-wider text-muted-foreground">Total</p>
        <p className="mt-1 text-xl font-semibold text-foreground">{stats.total}</p>
      </Link>

      {ALL_STATUSES.map((status) => {
        const count = stats.byStatus[status];
        const cfg = STATUS_CONFIG[status];
        const pct = stats.total > 0 ? Math.round((count / stats.total) * 100) : 0;
        const active = activeStatus === status;
        return (
          <Link
            key={status}
            href={`/companies?status=${status}`}
            className={cn(
              "flex flex-col rounded-lg border bg-card p-3 transition-colors hover:border-primary/40",
              active ? "border-primary/60" : "border-border"
            )}
          >
            <p className="truncate text-[11px] uppercase tracking-wider text-muted-foreground">
              {cfg.label}
            </p>
            <p className="mt-1 text-xl font-semibold text-foreground">{count}</p>
            <div className="mt-2 h-1 w-full overflow-hidden rounded-full bg-muted/40">
              <div
                className={cn("h-full rounded-full", cfg.badgeClass.split(" ")[1] ?? "bg-primary")}
                style={{ width: `${pct}%` }}
              />
            </div>
          </Link>
        );
      })}
    </div>
  );
}
