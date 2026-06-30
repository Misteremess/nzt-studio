"use client";

// features/home/components/news-card.tsx
// "Noticias del sector" card: displays the daily cached news batch (with a
// featured headline + a list of secondary stories) and lets the user force a
// re-search via refreshNewsAction.

import { useState, useTransition } from "react";
import { Newspaper, RefreshCw, ExternalLink, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { refreshNewsAction } from "@/features/home/actions";
import type { HomeNewsCategory, HomeNewsData, HomeNewsItem } from "@/features/home/types";

interface Props {
  news: HomeNewsData;
}

const CATEGORY_STYLES: Record<HomeNewsCategory, string> = {
  IA: "border-violet-500/30 bg-violet-500/10 text-violet-300",
  Pymes: "border-sky-500/30 bg-sky-500/10 text-sky-300",
  Herramientas: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
  Tendencias: "border-amber-500/30 bg-amber-500/10 text-amber-300",
};

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 1) return "ahora";
  if (m < 60) return `hace ${m} min`;
  const h = Math.floor(m / 60);
  if (h < 24) return `hace ${h} h`;
  const d = Math.floor(h / 24);
  return `hace ${d} d`;
}

function faviconUrl(url: string): string | null {
  try {
    const { hostname } = new URL(url);
    return `https://www.google.com/s2/favicons?sz=64&domain=${hostname}`;
  } catch {
    return null;
  }
}

function CategoryBadge({ category }: { category?: HomeNewsCategory }) {
  if (!category) return null;
  return (
    <Badge variant="outline" className={cn("shrink-0 text-[10px]", CATEGORY_STYLES[category])}>
      {category}
    </Badge>
  );
}

function NewsItemRow({ item }: { item: HomeNewsItem }) {
  const favicon = faviconUrl(item.url);
  return (
    <a
      href={item.url}
      target="_blank"
      rel="noreferrer"
      className="group flex items-start gap-3 rounded-lg p-2 transition-colors hover:bg-secondary/50"
    >
      <div className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center overflow-hidden rounded-md bg-secondary">
        {favicon ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={favicon} alt="" className="h-4 w-4" referrerPolicy="no-referrer" />
        ) : (
          <Newspaper className="h-3.5 w-3.5 text-muted-foreground" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <p className="text-xs font-medium leading-snug text-foreground group-hover:text-primary">
            {item.title}
          </p>
          <ExternalLink className="mt-0.5 h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
        </div>
        {item.summary && (
          <p className="mt-0.5 line-clamp-2 text-[11px] text-muted-foreground">{item.summary}</p>
        )}
        <div className="mt-1 flex items-center gap-1.5">
          <CategoryBadge category={item.category} />
          {item.source && <p className="truncate text-[10px] text-muted-foreground">{item.source}</p>}
        </div>
      </div>
    </a>
  );
}

export function NewsCard({ news: initialNews }: Props) {
  const [news, setNews] = useState(initialNews);
  const [refreshError, setRefreshError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleRefresh() {
    setRefreshError(null);
    startTransition(async () => {
      const res = await refreshNewsAction();
      if (res.ok) setNews(res.data);
      else setRefreshError(res.error);
    });
  }

  const [featured, ...rest] = news.items;
  const featuredFavicon = featured ? faviconUrl(featured.url) : null;

  return (
    <Card className="overflow-hidden">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Newspaper className="h-4 w-4" />
          Noticias del sector
        </CardTitle>
        <button
          onClick={handleRefresh}
          disabled={isPending}
          title="Actualizar noticias"
          className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-secondary/50 hover:text-foreground disabled:opacity-50"
        >
          <RefreshCw className={cn("h-3.5 w-3.5", isPending && "animate-spin")} />
        </button>
      </CardHeader>
      <CardContent className="p-4 pt-2">
        {featured ? (
          <div className="space-y-3">
            {/* Featured headline */}
            <a
              href={featured.url}
              target="_blank"
              rel="noreferrer"
              className="group relative block overflow-hidden rounded-xl border border-border/60 bg-gradient-to-br from-primary/15 via-secondary/40 to-transparent p-3.5 transition-colors hover:border-primary/40"
            >
              <div className="mb-2 flex items-center gap-1.5 text-[10px] font-medium uppercase tracking-wide text-primary">
                <Sparkles className="h-3 w-3" />
                Lo más destacado
              </div>
              <p className="text-sm font-semibold leading-snug text-foreground group-hover:text-primary">
                {featured.title}
              </p>
              {featured.summary && (
                <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{featured.summary}</p>
              )}
              <div className="mt-2.5 flex items-center gap-2">
                <CategoryBadge category={featured.category} />
                {featuredFavicon && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={featuredFavicon} alt="" className="h-3.5 w-3.5 rounded-sm" referrerPolicy="no-referrer" />
                )}
                {featured.source && (
                  <p className="truncate text-[10px] text-muted-foreground">{featured.source}</p>
                )}
                <ExternalLink className="ml-auto h-3 w-3 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
              </div>
            </a>

            {/* Remaining stories */}
            {rest.length > 0 && (
              <div className="-mx-2 space-y-0.5 border-t border-border/60 pt-1">
                {rest.map((item) => (
                  <NewsItemRow key={item.url} item={item} />
                ))}
              </div>
            )}
          </div>
        ) : (
          <div className="flex flex-col items-center gap-2 py-6 text-center">
            <Newspaper className="h-6 w-6 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              {refreshError ?? news.error ?? "Sin noticias todavía."}
            </p>
            <button
              onClick={handleRefresh}
              disabled={isPending}
              className="mt-1 inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-opacity hover:opacity-90 disabled:opacity-50"
            >
              <RefreshCw className={cn("h-3 w-3", isPending && "animate-spin")} />
              Buscar noticias
            </button>
          </div>
        )}
        {news.items.length > 0 && (
          <p className="mt-3 text-[10px] text-muted-foreground">
            {news.stale ? "Noticias de un día anterior" : "Actualizado"}
            {news.generatedAt && ` · ${timeAgo(news.generatedAt)}`}
          </p>
        )}
        {refreshError && news.items.length > 0 && (
          <p className="mt-1 text-[10px] text-rose-400">{refreshError}</p>
        )}
      </CardContent>
    </Card>
  );
}
