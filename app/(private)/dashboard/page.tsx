import {
  Building2,
  CheckCircle2,
  Clock,
  FileText,
  FolderKanban,
  Lightbulb,
  type LucideIcon,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

export default function DashboardPage() {
  const greeting = getGreeting(new Date().getHours());

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-8">
      <header className="flex flex-col gap-1">
        <h2 className="text-2xl font-semibold tracking-tight text-foreground">
          {greeting}, Ignacio
        </h2>
        <p className="text-sm text-muted-foreground">
          Resumen general de NZT Studio.
        </p>
      </header>

      <section
        aria-label="Métricas generales"
        className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4"
      >
        <KpiCard
          icon={Building2}
          label="Empresas analizadas"
          value="—"
          hint="Sin datos aún"
        />
        <KpiCard
          icon={Lightbulb}
          label="Oportunidades detectadas"
          value="—"
          hint="Sin datos aún"
        />
        <KpiCard
          icon={FileText}
          label="Propuestas activas"
          value="—"
          hint="Sin datos aún"
        />
        <KpiCard
          icon={FolderKanban}
          label="Proyectos en curso"
          value="—"
          hint="Sin datos aún"
        />
      </section>

      <section className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Actividad reciente</CardTitle>
            <CardDescription>
              Los movimientos del estudio aparecerán aquí.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-col items-center justify-center gap-2 rounded-md border border-dashed border-border/60 py-10 text-center">
              <Clock className="h-6 w-6 text-muted-foreground" aria-hidden />
              <p className="text-sm text-muted-foreground">
                Aún no hay actividad.
              </p>
              <p className="text-xs text-muted-foreground/80">
                Cuando registres tu primera empresa aparecerá aquí.
              </p>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Próximos pasos</CardTitle>
            <CardDescription>
              Tareas pendientes para cerrar el Sprint 1.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="space-y-3">
              <NextStep
                code="NZT-18"
                title="Configurar base de datos y ORM (Prisma)"
              />
              <NextStep
                code="NZT-19"
                title="Definir esquema inicial de datos"
              />
              <NextStep
                code="NZT-20"
                title="Configurar acceso privado"
              />
            </ul>
          </CardContent>
        </Card>
      </section>
    </div>
  );
}

function KpiCard({
  icon: Icon,
  label,
  value,
  hint,
}: {
  icon: LucideIcon;
  label: string;
  value: string;
  hint: string;
}) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between space-y-0 pb-2">
        <CardTitle className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {label}
        </CardTitle>
        <Icon className="h-4 w-4 text-muted-foreground" aria-hidden />
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-semibold tabular-nums text-foreground">
          {value}
        </div>
        <p className="mt-1 text-xs text-muted-foreground">{hint}</p>
      </CardContent>
    </Card>
  );
}

function NextStep({ code, title }: { code: string; title: string }) {
  return (
    <li className="flex items-start gap-3 text-sm">
      <CheckCircle2
        className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/60"
        aria-hidden
      />
      <div className="flex flex-col">
        <span className="font-mono text-[11px] uppercase tracking-wider text-muted-foreground">
          {code}
        </span>
        <span className="text-foreground/90">{title}</span>
      </div>
    </li>
  );
}

function getGreeting(hour: number): string {
  if (hour < 6) return "Buenas noches";
  if (hour < 13) return "Buenos días";
  if (hour < 21) return "Buenas tardes";
  return "Buenas noches";
}
