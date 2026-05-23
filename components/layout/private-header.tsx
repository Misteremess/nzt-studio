"use client";

import { usePathname } from "next/navigation";

const sectionTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/companies": "Companies",
  "/market-intelligence": "Market Intelligence",
  "/company-analyzer": "Company Analyzer",
  "/opportunity-engine": "Opportunity Engine",
  "/mvp-factory": "MVP Factory",
  "/pricing-studio": "Pricing Studio",
  "/proposal-builder": "Proposal Builder",
  "/delivery-workspace": "Delivery Workspace",
  "/knowledge-base": "Knowledge Base",
};

function resolveSectionTitle(pathname: string): string {
  const match = Object.entries(sectionTitles).find(
    ([key]) => pathname === key || pathname.startsWith(key + "/")
  );
  return match?.[1] ?? "NZT Studio";
}

export function PrivateHeader() {
  const pathname = usePathname();
  const title = resolveSectionTitle(pathname);

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-6">
      <span className="text-sm font-medium text-foreground">{title}</span>
      <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
        <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
        Private workspace
      </span>
    </header>
  );
}
