import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";

interface CompaniesPaginationProps {
  page: number;
  totalPages: number;
  params: Record<string, string | undefined>;
}

function buildPageUrl(
  params: Record<string, string | undefined>,
  page: number
): string {
  const p = new URLSearchParams();
  if (params.q) p.set("q", params.q);
  if (params.status) p.set("status", params.status);
  if (params.sector) p.set("sector", params.sector);
  if (params.city) p.set("city", params.city);
  if (page > 1) p.set("page", String(page));
  const qs = p.toString();
  return qs ? `?${qs}` : "?";
}

export function CompaniesPagination({
  page,
  totalPages,
  params,
}: CompaniesPaginationProps) {
  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between pt-2">
      <p className="text-xs text-muted-foreground">
        Página {page} de {totalPages}
      </p>
      <div className="flex items-center gap-1.5">
        {page > 1 ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageUrl(params, page - 1)}>
              <ChevronLeft className="h-4 w-4" />
              Anterior
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            <ChevronLeft className="h-4 w-4" />
            Anterior
          </Button>
        )}
        {page < totalPages ? (
          <Button asChild variant="outline" size="sm">
            <Link href={buildPageUrl(params, page + 1)}>
              Siguiente
              <ChevronRight className="h-4 w-4" />
            </Link>
          </Button>
        ) : (
          <Button variant="outline" size="sm" disabled>
            Siguiente
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
