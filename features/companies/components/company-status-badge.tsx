import { Badge } from "@/components/ui/badge";
import { getStatusConfig } from "@/features/companies/lib/status";
import { cn } from "@/lib/utils";
import type { CompanyStatus } from "@/features/companies/types";

interface CompanyStatusBadgeProps {
  status: CompanyStatus;
  className?: string;
}

export function CompanyStatusBadge({ status, className }: CompanyStatusBadgeProps) {
  const { label, badgeClass } = getStatusConfig(status);
  return (
    <Badge variant="outline" className={cn(badgeClass, className)}>
      {label}
    </Badge>
  );
}
