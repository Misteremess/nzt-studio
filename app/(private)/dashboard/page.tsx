// app/(private)/dashboard/page.tsx
// Dashboard — full-width analytics overview of the entire NZT pipeline.

import { getDashboardData } from "@/features/dashboard/lib/store";
import { DashboardView } from "@/features/dashboard/components/dashboard-view";

export default async function DashboardPage() {
  const data = await getDashboardData();

  return (
    <div className="mx-auto w-full max-w-7xl">
      <DashboardView data={data} />
    </div>
  );
}
