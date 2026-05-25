import { notFound } from "next/navigation";
import { prisma } from "@/db/prisma";
import { CompanyDetailView } from "@/features/companies/components/company-detail-view";

export default async function CompanyDetailPage({
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
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!company) notFound();

  return (
    <div className="max-w-5xl">
      <CompanyDetailView company={company} />
    </div>
  );
}
