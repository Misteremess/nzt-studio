// app/(private)/companies/pipeline/page.tsx
// Pipeline de ventas: tablero kanban de empresas por estado comercial.

import Link from "next/link";
import { LayoutGrid } from "lucide-react";

import { Button } from "@/components/ui/button";
import { getPipelineCompanies } from "@/features/companies/data";
import { PipelineBoard } from "@/features/companies/components/pipeline-board";

export const metadata = {
  title: "Pipeline de ventas — NZT Studio",
};

export default async function PipelinePage() {
  const companies = await getPipelineCompanies();

  return (
    <div className="mx-auto w-full max-w-7xl space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-foreground">Pipeline de ventas</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            De empresa detectada a cliente firmado — sin que se escape ninguna.
          </p>
        </div>
        <Button asChild variant="outline">
          <Link href="/companies">
            <LayoutGrid />
            Vista lista
          </Link>
        </Button>
      </div>

      <PipelineBoard companies={companies} />
    </div>
  );
}
