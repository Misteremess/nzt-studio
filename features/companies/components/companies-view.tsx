import { Suspense } from "react";
import Link from "next/link";
import { Building2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { CompaniesFilters } from "@/features/companies/components/companies-filters";
import { CompanyCard } from "@/features/companies/components/company-card";
import { CompaniesPagination } from "@/features/companies/components/companies-pagination";
import type { CompanyListItem } from "@/features/companies/types";
import type { FilterOptions } from "@/features/companies/data";

interface CompaniesViewProps {
  companies: CompanyListItem[];
  total: number;
  page: number;
  totalPages: number;
  hasFilters: boolean;
  filterOptions: FilterOptions;
  params: Record<string, string | undefined>;
}

export function CompaniesView({
  companies,
  total,
  page,
  totalPages,
  hasFilters,
  filterOptions,
  params,
}: CompaniesViewProps) {
  // CRM vacío: no hay datos en la BD y no hay filtros activos
  if (!hasFilters && total === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-center">
        <Building2 className="h-12 w-12 text-muted-foreground/25 mb-4" />
        <p className="text-sm font-medium text-foreground">
          Sin empresas registradas
        </p>
        <p className="text-sm text-muted-foreground mt-1 max-w-xs">
          Añade la primera empresa candidata para empezar el CRM.
        </p>
        <Button asChild className="mt-5">
          <Link href="/companies/new">Nueva empresa</Link>
        </Button>
      </div>
    );
  }

  const countLabel =
    total === 0
      ? "Sin resultados"
      : total === 1
        ? "1 empresa"
        : `${total} empresa${total !== 1 ? "s" : ""}`;

  return (
    <div className="space-y-4">
      <Suspense>
        <CompaniesFilters filterOptions={filterOptions} />
      </Suspense>

      <p className="text-xs text-muted-foreground">
        {countLabel}
        {totalPages > 1 && ` · página ${page} de ${totalPages}`}
      </p>

      {total === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <Search className="h-10 w-10 text-muted-foreground/25 mb-4" />
          <p className="text-sm font-medium text-foreground">Sin resultados</p>
          <p className="text-sm text-muted-foreground mt-1">
            Ninguna empresa coincide con los filtros actuales.
          </p>
          <Button asChild variant="ghost" size="sm" className="mt-3">
            <Link href="/companies">Limpiar filtros</Link>
          </Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {companies.map((company) => (
              <CompanyCard key={company.id} company={company} />
            ))}
          </div>
          <CompaniesPagination
            page={page}
            totalPages={totalPages}
            params={params}
          />
        </>
      )}
    </div>
  );
}
