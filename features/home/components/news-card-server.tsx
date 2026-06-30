// features/home/components/news-card-server.tsx
// Server-only async wrapper: fetches today's cached/fresh sector news and
// hands it to the interactive NewsCard. Meant to be rendered inside <Suspense>.
import "server-only";

import { getOrRefreshNews } from "@/features/home/lib/news";
import { NewsCard } from "@/features/home/components/news-card";

export async function NewsCardServer() {
  const news = await getOrRefreshNews();
  return <NewsCard news={news} />;
}
