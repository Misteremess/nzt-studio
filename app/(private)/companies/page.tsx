import Link from "next/link";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getCompanies, getFilterOptions } from "@/features/companies/data";
import { CompaniesView } from "@/features/companies/components/companies-view";
import { ALL_STATUSES } from "@/features/companies/lib/status";
import type { CompanyStatus } from "@/features/companies/types";

interface PageSearchParams {
  q?: string;
  status?: string;
  sector?: string;
  city?: string;
  page?: string;
}

export default async function CompaniesPage({
  searchParams,
}: {
  searchParams: Promise<PageSearchParams>;
}) {
  const raw = await searchParams;

  const q = raw.q?.trim() || undefined;
  const status = ALL_STATUSES.includes(raw.status as CompanyStatus)
    ? (raw.status as CompanyStatus)
    : undefined;
  const sector = raw.sector || undefined;
  const city = raw.city || undefined;
  const page = Math.max(1, parseInt(raw.page ?? "1", 10) || 1);
  const hasFilters = !!(q || status || sector || city);

  const [result, filterOptions] = await Promise.all([
    getCompanies({ q, status, sector, city }, page),
    getFilterOptions(),
  ]);

  const params: Record<string, string | undefined> = {
    q: raw.q,
    status: raw.status,
    sector: raw.sector,
    city: raw.city,
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Companies</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Empresas candidatas para proyectos web y software.
          </p>
        </div>
        <Button asChild>
          <Link href="/companies/new">
            <Plus />
            Nueva empresa
          </Link>
        </Button>
      </div>

      <CompaniesView
        companies={result.companies}
        total={result.total}
        page={result.page}
        totalPages={result.totalPages}
        hasFilters={hasFilters}
        filterOptions={filterOptions}
        params={params}
      />
    </div>
  );
}
