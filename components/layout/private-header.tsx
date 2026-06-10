"use client";

import { usePathname } from "next/navigation";
import { signOut } from "next-auth/react";
import { LogOut, Settings } from "lucide-react";

import { GradientText } from "@/components/ui/gradient-text";
import { useSettings } from "@/components/settings/settings-modal";
import { useTheme } from "@/components/theme/theme-provider";
import { accentById, accentGradientColors } from "@/lib/theme/theme";

const sectionTitles: Record<string, string> = {
  "/dashboard": "Dashboard",
  "/companies": "Companies",
  "/market-intelligence": "Market Intelligence",
  "/rastreador": "Rastreador",
  "/analyzer": "Analyzer",
  "/company-analyzer": "Company Analyzer",
  "/opportunity-engine": "Opportunity Engine",
  "/mvp-factory": "MVP Factory",
  "/pricing-studio": "Pricing Studio",
  "/proposal-builder": "Proposal Builder",
  "/delivery-workspace": "Delivery Workspace",
  "/knowledge-base": "Knowledge Base",
};

function resolveSectionTitle(pathname: string): string | null {
  const match = Object.entries(sectionTitles).find(
    ([key]) => pathname === key || pathname.startsWith(key + "/")
  );
  return match?.[1] ?? null;
}

export function PrivateHeader() {
  const pathname = usePathname();
  const moduleTitle = resolveSectionTitle(pathname);
  const { open: openSettings } = useSettings();
  const { accent } = useTheme();
  const gradientColors = accentGradientColors(accentById(accent).hsl);

  return (
    <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-border bg-card px-6 print:hidden">
      <div className="flex items-center gap-3 min-w-0">
        <div className="flex h-12 shrink-0 items-center" aria-label="NZT Studio">
          <GradientText colors={gradientColors} animationSpeed={6} className="text-xl font-semibold tracking-tight">
            NZT Studio
          </GradientText>
        </div>
        {moduleTitle && (
          <>
            <span className="h-4 w-px bg-border shrink-0" aria-hidden />
            <span className="truncate text-xs font-medium text-muted-foreground">
              {moduleTitle}
            </span>
          </>
        )}
      </div>
      <div className="flex items-center gap-3">
        <button
          onClick={openSettings}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Ajustes"
        >
          <Settings className="h-3.5 w-3.5" />
          <span>Ajustes</span>
        </button>
        <button
          onClick={() => signOut({ callbackUrl: "/login" })}
          className="flex items-center gap-1.5 text-xs text-muted-foreground transition-colors hover:text-foreground"
          aria-label="Cerrar sesión"
        >
          <LogOut className="h-3.5 w-3.5" />
          <span>Salir</span>
        </button>
        <span className="inline-flex items-center gap-1.5 text-xs text-muted-foreground">
          <span className="h-1.5 w-1.5 rounded-full bg-primary/60" />
          Private workspace
        </span>
      </div>
    </header>
  );
}
