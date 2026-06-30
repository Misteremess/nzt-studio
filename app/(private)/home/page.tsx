// app/(private)/home/page.tsx
// Home — landing page: greeting, pipeline stats, today's suggestions, daily
// sector news and quick links to every module.

import { Suspense } from "react";

import { getHomeData } from "@/features/home/lib/store";
import { HomeView } from "@/features/home/components/home-view";
import { NewsCardServer } from "@/features/home/components/news-card-server";
import { NewsCardSkeleton } from "@/features/home/components/news-card-skeleton";

export default async function HomePage() {
  const data = await getHomeData();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <HomeView
        data={data}
        newsCard={
          <Suspense fallback={<NewsCardSkeleton />}>
            <NewsCardServer />
          </Suspense>
        }
      />
    </div>
  );
}
