import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { notFound } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { prisma } from "@/db/prisma";
import { CompanyForm } from "@/features/companies/components/company-form";
import { updateCompanyAction } from "@/features/companies/actions";

export default async function EditCompanyPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  const company = await prisma.company.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      sector: true,
      city: true,
      website: true,
      email: true,
      phone: true,
      mapsUrl: true,
      notes: true,
      status: true,
    },
  });

  if (!company) notFound();

  const action = updateCompanyAction.bind(null, company.id);

  return (
    <div className="max-w-2xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
          <Link href={`/companies/${company.id}`}>
            <ArrowLeft />
            {company.name}
          </Link>
        </Button>
        <h1 className="text-xl font-semibold text-foreground mt-2">Editar empresa</h1>
        <p className="text-sm text-muted-foreground mt-0.5">{company.name}</p>
      </div>

      <Card>
        <CardContent className="p-6">
          <CompanyForm
            defaultValues={company}
            action={action}
            submitLabel="Guardar cambios"
            cancelHref={`/companies/${company.id}`}
          />
        </CardContent>
      </Card>
    </div>
  );
}
