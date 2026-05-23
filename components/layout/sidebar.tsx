"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Building2,
  TrendingUp,
  ScanSearch,
  Zap,
  Code2,
  Calculator,
  FileText,
  Briefcase,
  BookOpen,
} from "lucide-react";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
}

const navItems: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "Companies", href: "/companies", icon: Building2 },
  { label: "Market Intelligence", href: "/market-intelligence", icon: TrendingUp },
  { label: "Company Analyzer", href: "/company-analyzer", icon: ScanSearch },
  { label: "Opportunity Engine", href: "/opportunity-engine", icon: Zap },
  { label: "MVP Factory", href: "/mvp-factory", icon: Code2 },
  { label: "Pricing Studio", href: "/pricing-studio", icon: Calculator },
  { label: "Proposal Builder", href: "/proposal-builder", icon: FileText },
  { label: "Delivery Workspace", href: "/delivery-workspace", icon: Briefcase },
  { label: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
];

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex w-56 flex-shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-14 items-center border-b border-border px-4">
        <div>
          <p className="text-sm font-semibold text-foreground tracking-tight">
            NZT Studio
          </p>
          <p className="text-[10px] leading-tight text-muted-foreground">
            Private AI Venture Studio
          </p>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            const isActive =
              pathname === item.href ||
              pathname.startsWith(item.href + "/");

            return (
              <li key={item.href}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2.5 rounded-md px-3 py-2 text-sm transition-colors",
                    isActive
                      ? "bg-primary/10 text-primary font-medium"
                      : "text-muted-foreground hover:bg-secondary hover:text-foreground"
                  )}
                >
                  <Icon className="h-4 w-4 flex-shrink-0" />
                  <span className="truncate">{item.label}</span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <div className="border-t border-border px-4 py-3">
        <div className="flex items-center gap-2">
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 flex-shrink-0" />
          <span className="text-xs text-muted-foreground">System active</span>
        </div>
      </div>
    </aside>
  );
}
