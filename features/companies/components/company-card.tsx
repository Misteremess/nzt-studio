import Link from "next/link";
import { ExternalLink } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { CompanyStatusBadge } from "@/features/companies/components/company-status-badge";
import { formatDate } from "@/lib/utils";
import type { CompanyListItem } from "@/features/companies/types";

interface CompanyCardProps {
  company: CompanyListItem;
}

export function CompanyCard({ company }: CompanyCardProps) {
  return (
    <Link href={`/companies/${company.id}`} className="block">
      <Card className="hover:bg-secondary/50 transition-colors cursor-pointer h-full">
        <CardContent className="p-4 space-y-2.5">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm font-semibold text-foreground leading-snug">
              {company.name}
            </p>
            <CompanyStatusBadge status={company.status} className="shrink-0" />
          </div>

          <div className="space-y-1">
            {(company.sector || company.city) && (
              <p className="text-xs text-muted-foreground">
                {[company.sector, company.city].filter(Boolean).join(" · ")}
              </p>
            )}
            {company.website && (
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <ExternalLink className="h-3 w-3 shrink-0" />
                <span className="truncate">
                  {company.website.replace(/^https?:\/\//, "")}
                </span>
              </p>
            )}
          </div>

          <p className="text-[10px] text-muted-foreground/50">
            Añadida {formatDate(company.createdAt)}
          </p>
        </CardContent>
      </Card>
    </Link>
  );
}
