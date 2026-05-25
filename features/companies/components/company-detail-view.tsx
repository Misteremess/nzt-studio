import type { ReactNode } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Pencil,
  Globe,
  MapPin,
  Mail,
  Phone,
  FileText,
  ScanSearch,
  Zap,
  Calendar,
  RefreshCw,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { CompanyStatusBadge } from "@/features/companies/components/company-status-badge";
import { formatDate } from "@/lib/utils";
import type { CompanyDetail } from "@/features/companies/types";

interface CompanyDetailViewProps {
  company: CompanyDetail;
}

function SectionLabel({ children }: { children: ReactNode }) {
  return (
    <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
      {children}
    </p>
  );
}

function FieldRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-xs text-muted-foreground leading-5">
        {label}
      </span>
      <div className="min-w-0 text-sm text-foreground">{children}</div>
    </div>
  );
}

function PlaceholderCard({
  icon,
  title,
  description,
  sprint,
}: {
  icon: ReactNode;
  title: string;
  description: string;
  sprint: string;
}) {
  return (
    <Card className="border-dashed">
      <CardContent className="p-4 space-y-2">
        <div className="flex items-center justify-between">
          <div className="text-muted-foreground/30">{icon}</div>
          <Badge variant="outline" className="text-xs border-dashed text-muted-foreground">
            {sprint}
          </Badge>
        </div>
        <p className="text-sm font-medium text-foreground/50">{title}</p>
        <p className="text-xs text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  );
}

function safeHref(url: string): string | null {
  return url.startsWith("http://") || url.startsWith("https://") ? url : null;
}

export function CompanyDetailView({ company }: CompanyDetailViewProps) {
  const hasPresencia = company.website || company.mapsUrl;
  const hasContacto = company.email || company.phone;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1 min-w-0">
          <Button asChild variant="ghost" size="sm" className="-ml-2 text-muted-foreground">
            <Link href="/companies">
              <ArrowLeft />
              Companies
            </Link>
          </Button>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <h1 className="text-xl font-semibold text-foreground">{company.name}</h1>
            <CompanyStatusBadge status={company.status} />
          </div>
          {(company.sector || company.city) && (
            <p className="text-sm text-muted-foreground">
              {[company.sector, company.city].filter(Boolean).join(" · ")}
            </p>
          )}
        </div>
        <Button asChild variant="outline" size="sm" className="shrink-0 mt-8">
          <Link href={`/companies/${company.id}/edit`}>
            <Pencil />
            Editar
          </Link>
        </Button>
      </div>

      {/* Fila 1: Datos principales + Presencia digital */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <SectionLabel>Datos principales</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-2.5">
            <FieldRow label="Nombre">{company.name}</FieldRow>
            {company.sector && <FieldRow label="Sector">{company.sector}</FieldRow>}
            {company.city && <FieldRow label="Ciudad">{company.city}</FieldRow>}
            <FieldRow label="Estado">
              <CompanyStatusBadge status={company.status} />
            </FieldRow>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <SectionLabel>Presencia digital</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {hasPresencia ? (
              <>
                {company.website && (
                  <FieldRow label="Website">
                    {safeHref(company.website) ? (
                      <a
                        href={safeHref(company.website)!}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline break-all"
                      >
                        <Globe className="h-3 w-3 shrink-0" />
                        {company.website.replace(/^https?:\/\//, "")}
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <Globe className="h-3 w-3 shrink-0" />
                        {company.website}
                      </span>
                    )}
                  </FieldRow>
                )}
                {company.mapsUrl && (
                  <FieldRow label="Maps">
                    {safeHref(company.mapsUrl) ? (
                      <a
                        href={safeHref(company.mapsUrl)!}
                        target="_blank"
                        rel="noreferrer"
                        className="flex items-center gap-1.5 text-primary hover:underline"
                      >
                        <MapPin className="h-3 w-3 shrink-0" />
                        Ver en Google Maps
                      </a>
                    ) : (
                      <span className="flex items-center gap-1.5 text-muted-foreground">
                        <MapPin className="h-3 w-3 shrink-0" />
                        {company.mapsUrl}
                      </span>
                    )}
                  </FieldRow>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin datos digitales registrados.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Fila 2: Contacto + Notas */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <Card>
          <CardHeader className="pb-3">
            <SectionLabel>Contacto público</SectionLabel>
          </CardHeader>
          <CardContent className="space-y-2.5">
            {hasContacto ? (
              <>
                {company.email && (
                  <FieldRow label="Email">
                    <span className="flex items-center gap-1.5">
                      <Mail className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {company.email}
                    </span>
                  </FieldRow>
                )}
                {company.phone && (
                  <FieldRow label="Teléfono">
                    <span className="flex items-center gap-1.5">
                      <Phone className="h-3 w-3 shrink-0 text-muted-foreground" />
                      {company.phone}
                    </span>
                  </FieldRow>
                )}
              </>
            ) : (
              <p className="text-sm text-muted-foreground">
                Sin datos de contacto registrados.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-3">
            <SectionLabel>Notas internas</SectionLabel>
          </CardHeader>
          <CardContent>
            {company.notes ? (
              <p className="text-sm text-foreground whitespace-pre-wrap leading-relaxed">
                {company.notes}
              </p>
            ) : (
              <div className="flex items-start gap-2 text-muted-foreground">
                <FileText className="h-4 w-4 mt-0.5 shrink-0" />
                <p className="text-sm">
                  Sin notas. Edita la empresa para añadir observaciones internas.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Metadatos */}
      <Card>
        <CardContent className="flex flex-wrap items-center gap-6 p-4">
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Calendar className="h-3.5 w-3.5" />
            Creada el{" "}
            <span className="text-foreground">{formatDate(company.createdAt)}</span>
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <RefreshCw className="h-3.5 w-3.5" />
            Actualizada el{" "}
            <span className="text-foreground">{formatDate(company.updatedAt)}</span>
          </div>
        </CardContent>
      </Card>

      {/* Placeholders módulos futuros */}
      <div>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Próximos módulos
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <PlaceholderCard
            icon={<ScanSearch className="h-5 w-5" />}
            title="Análisis web"
            description="Análisis técnico del sitio web de la empresa."
            sprint="Sprint 3"
          />
          <PlaceholderCard
            icon={<Zap className="h-5 w-5" />}
            title="Oportunidades"
            description="Oportunidades digitales detectadas para esta empresa."
            sprint="Sprint 3"
          />
          <PlaceholderCard
            icon={<FileText className="h-5 w-5" />}
            title="Propuestas"
            description="Propuestas comerciales generadas para esta empresa."
            sprint="Sprint 4"
          />
        </div>
      </div>
    </div>
  );
}
