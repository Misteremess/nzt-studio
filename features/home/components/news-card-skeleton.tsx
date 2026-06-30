// features/home/components/news-card-skeleton.tsx
// Loading placeholder for NewsCard while the daily web search runs.

import { Newspaper } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export function NewsCardSkeleton() {
  return (
    <Card>
      <CardHeader className="p-4 pb-2">
        <CardTitle className="flex items-center gap-2 text-sm">
          <Newspaper className="h-4 w-4" />
          Noticias del sector
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 p-4 pt-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="space-y-1.5">
            <div className="h-3 w-3/4 animate-pulse rounded bg-secondary" />
            <div className="h-2.5 w-full animate-pulse rounded bg-secondary/70" />
          </div>
        ))}
        <p className="pt-1 text-[10px] text-muted-foreground">Buscando noticias del sector…</p>
      </CardContent>
    </Card>
  );
}
