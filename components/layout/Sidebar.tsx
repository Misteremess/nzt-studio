"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import { Separator } from "@/components/ui/separator";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { NAV_SECTIONS, type NavItem } from "./nav";

export function Sidebar() {
  const pathname = usePathname();

  return (
    <aside className="flex h-screen w-60 shrink-0 flex-col border-r border-border bg-sidebar text-sidebar-foreground">
      <div className="flex h-14 items-center gap-2 px-4">
        <span className="inline-flex h-7 w-7 items-center justify-center rounded-md bg-primary text-primary-foreground font-mono text-xs font-semibold">
          NZ
        </span>
        <span className="font-mono text-sm font-semibold tracking-tight">
          NZT Studio
        </span>
      </div>
      <Separator />
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        {NAV_SECTIONS.map((section, idx) => (
          <div key={idx} className={cn(idx > 0 && "mt-6")}>
            {section.label ? (
              <p className="mb-2 px-2 text-xs font-medium uppercase tracking-wider text-muted-foreground">
                {section.label}
              </p>
            ) : null}
            <ul className="space-y-0.5">
              {section.items.map((item) => (
                <SidebarItem
                  key={item.href}
                  item={item}
                  active={
                    pathname === item.href || pathname.startsWith(`${item.href}/`)
                  }
                />
              ))}
            </ul>
          </div>
        ))}
      </nav>
      <div className="px-4 py-3 text-[11px] text-muted-foreground">
        <span className="font-mono">Sprint 1</span> · v0.1.0
      </div>
    </aside>
  );
}

const baseItemClasses =
  "flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-sm transition-colors";

function SidebarItem({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  const content = (
    <>
      <Icon className="h-4 w-4 shrink-0" aria-hidden />
      <span className="truncate">{item.label}</span>
      {item.upcoming ? (
        <span className="ml-auto text-[10px] uppercase tracking-wider text-muted-foreground/70">
          pronto
        </span>
      ) : null}
    </>
  );

  if (item.upcoming) {
    return (
      <li>
        <Tooltip>
          <TooltipTrigger
            type="button"
            disabled
            className={cn(
              baseItemClasses,
              "cursor-not-allowed text-muted-foreground/60 disabled:pointer-events-auto",
            )}
          >
            {content}
          </TooltipTrigger>
          <TooltipContent side="right">
            Disponible en próximos sprints
          </TooltipContent>
        </Tooltip>
      </li>
    );
  }

  return (
    <li>
      <Link
        href={item.href}
        className={cn(
          baseItemClasses,
          active
            ? "bg-sidebar-accent text-sidebar-accent-foreground"
            : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-accent-foreground",
        )}
        aria-current={active ? "page" : undefined}
      >
        {content}
      </Link>
    </li>
  );
}
