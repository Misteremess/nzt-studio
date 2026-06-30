"use client";

// features/home/components/home-view.tsx
// Home landing page: greeting, pipeline stats, today's suggestions, daily
// sector news (web search, cached) and quick links to every module.

import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Lightbulb,
  Rocket,
  Calculator,
  FileText,
  Users,
  Radar,
  Building2,
  Zap,
  Briefcase,
  ScanSearch,
  TrendingUp,
  Code2,
  Mail,
  Bot,
  BookOpen,
} from "lucide-react";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { StatTile } from "@/components/ui/charts";
import { GradientText } from "@/components/ui/gradient-text";
import { useTheme } from "@/components/theme/theme-provider";
import { accentById, accentGradientColors } from "@/lib/theme/theme";
import type { HomeData, HomeSuggestionIcon } from "@/features/home/types";

interface Props {
  data: HomeData;
  newsCard: ReactNode;
}

const SUGGESTION_ICONS: Record<HomeSuggestionIcon, React.ComponentType<{ className?: string }>> = {
  Lightbulb,
  Rocket,
  Calculator,
  FileText,
  Users,
  Radar,
};

const QUICK_LINKS = [
  { title: "Companies", href: "/companies", icon: Building2 },
  { title: "Rastreador", href: "/rastreador", icon: Radar },
  { title: "Analyzer", href: "/analyzer", icon: ScanSearch },
  { title: "Opportunity Engine", href: "/opportunity-engine", icon: Zap },
  { title: "MVP Factory", href: "/mvp-factory", icon: Code2 },
  { title: "Pricing Studio", href: "/pricing-studio", icon: Calculator },
  { title: "Proposal Builder", href: "/proposal-builder", icon: FileText },
  { title: "Delivery Workspace", href: "/delivery-workspace", icon: Briefcase },
  { title: "Email Generator", href: "/email-generator", icon: Mail },
  { title: "AI Agents", href: "/ai-agents", icon: Bot },
  { title: "Market Intelligence", href: "/market-intelligence", icon: TrendingUp },
  { title: "Knowledge Base", href: "/knowledge-base", icon: BookOpen },
];

function greeting(): string {
  const h = new Date().getHours();
  if (h < 6) return "Buenas noches";
  if (h < 13) return "Buenos días";
  if (h < 20) return "Buenas tardes";
  return "Buenas noches";
}

export function HomeView({ data, newsCard }: Props) {
  const { accent } = useTheme();
  const gradientColors = accentGradientColors(accentById(accent).hsl);

  const today = new Date().toLocaleDateString("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
  });

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div>
        <GradientText
          colors={gradientColors}
          animationSpeed={6}
          className="!mx-0 !max-w-none justify-start text-2xl font-semibold tracking-tight"
        >
          {greeting()} 👋
        </GradientText>
        <p className="mt-1 text-xs capitalize text-muted-foreground">
          {today} · Esto es lo que está pasando en NZT Studio hoy.
        </p>
      </div>

      {/* Stats strip */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatTile label="Empresas" value={data.stats.companies} icon={<Building2 className="h-4 w-4" />} />
        <StatTile
          label="Oportunidades"
          value={data.stats.opportunities}
          icon={<Zap className="h-4 w-4" />}
          accent="#34d399"
        />
        <StatTile
          label="Entregas activas"
          value={data.stats.activeDeliveries}
          icon={<Briefcase className="h-4 w-4" />}
          accent="#60a5fa"
        />
        <StatTile
          label="Propuestas"
          value={data.stats.proposals}
          icon={<FileText className="h-4 w-4" />}
          accent="#fbbf24"
        />
      </div>

      {/* Suggestions + News */}
      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader className="p-4 pb-2">
            <CardTitle className="flex items-center gap-2 text-sm">
              <Lightbulb className="h-4 w-4" />
              Hoy toca
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 p-4 pt-2">
            {data.suggestions.map((s) => {
              const Icon = SUGGESTION_ICONS[s.icon];
              return (
                <Link
                  key={s.id}
                  href={s.href}
                  className="group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-secondary/50"
                >
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <Icon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-xs font-medium text-foreground">{s.title}</p>
                    <p className="truncate text-[11px] text-muted-foreground">{s.description}</p>
                  </div>
                  {s.count > 0 && (
                    <Badge variant="secondary" className="shrink-0">
                      {s.count}
                    </Badge>
                  )}
                  <ArrowRight className="h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                </Link>
              );
            })}
          </CardContent>
        </Card>

        {newsCard}
      </div>

      {/* Quick links */}
      <div>
        <p className="mb-2.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
          Accesos rápidos
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {QUICK_LINKS.map((l) => {
            const Icon = l.icon;
            return (
              <Link key={l.href} href={l.href} className="group">
                <Card className="h-full transition-colors hover:border-primary/40 hover:bg-secondary/50">
                  <CardContent className="flex items-center gap-2 p-3">
                    <Icon className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
                    <span className="truncate text-xs font-medium text-foreground">{l.title}</span>
                    <ArrowRight className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
                  </CardContent>
                </Card>
              </Link>
            );
          })}
        </div>
      </div>
    </div>
  );
}
