import Link from "next/link";
import {
  Building2,
  ScanSearch,
  Zap,
  Code2,
  FileText,
  Database,
  Lock,
} from "lucide-react";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import type { LucideIcon } from "lucide-react";

const stats = [
  { label: "Empresas analizadas", value: "0" },
  { label: "Oportunidades detectadas", value: "0" },
  { label: "Propuestas generadas", value: "0" },
  { label: "Proyectos activos", value: "0" },
];

interface Module {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
}

const modules: Module[] = [
  {
    title: "Companies",
    description: "Gestión y seguimiento de empresas analizadas.",
    href: "/companies",
    icon: Building2,
  },
  {
    title: "Company Analyzer",
    description: "Análisis técnico de sitios web de empresas.",
    href: "/company-analyzer",
    icon: ScanSearch,
  },
  {
    title: "Opportunity Engine",
    description: "Detección de oportunidades digitales vendibles.",
    href: "/opportunity-engine",
    icon: Zap,
  },
  {
    title: "MVP Factory",
    description: "Generación de especificaciones de MVPs.",
    href: "/mvp-factory",
    icon: Code2,
  },
  {
    title: "Proposal Builder",
    description: "Creación de propuestas comerciales completas.",
    href: "/proposal-builder",
    icon: FileText,
  },
];

interface NextAction {
  icon: LucideIcon;
  title: string;
  description: string;
  tag: string;
}

const nextActions: NextAction[] = [
  {
    icon: Database,
    title: "Configurar PostgreSQL + Prisma",
    description:
      "Base de datos para persistencia de empresas, oportunidades y propuestas.",
    tag: "NZT-18",
  },
  {
    icon: Lock,
    title: "Configurar autenticación privada",
    description:
      "Acceso protegido con credenciales. Sin registro público.",
    tag: "NZT-20",
  },
];

export default function DashboardPage() {
  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <div className="flex items-center gap-2 mb-1">
          <h2 className="text-lg font-semibold text-foreground">NZT Studio</h2>
          <Badge variant="secondary">v0.1.0</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Plataforma privada de productividad con IA para análisis de mercado,
          detección de oportunidades y generación de MVPs.
        </p>
      </div>

      <section>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Estado del sistema
        </p>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {stats.map((stat) => (
            <Card key={stat.label}>
              <CardContent className="p-4">
                <p className="text-2xl font-bold text-foreground tabular-nums">
                  {stat.value}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {stat.label}
                </p>
              </CardContent>
            </Card>
          ))}
        </div>
        <p className="text-xs text-muted-foreground mt-2">
          Sin datos reales — base de datos no configurada.
        </p>
      </section>

      <section>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Módulos principales
        </p>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {modules.map((mod) => {
            const Icon = mod.icon;
            return (
              <Link key={mod.href} href={mod.href} className="block">
                <Card className="hover:bg-secondary transition-colors cursor-pointer h-full">
                  <CardHeader className="p-4 pb-2">
                    <div className="flex items-center gap-2 mb-1">
                      <Icon className="h-4 w-4 text-muted-foreground" />
                      <CardTitle className="text-sm font-medium">
                        {mod.title}
                      </CardTitle>
                    </div>
                    <CardDescription className="text-xs leading-relaxed">
                      {mod.description}
                    </CardDescription>
                  </CardHeader>
                </Card>
              </Link>
            );
          })}
        </div>
      </section>

      <section>
        <p className="text-xs font-medium uppercase tracking-wider text-muted-foreground mb-3">
          Próxima acción recomendada
        </p>
        <div className="space-y-2">
          {nextActions.map((action) => {
            const Icon = action.icon;
            return (
              <Card key={action.tag}>
                <CardContent className="flex items-start gap-3 p-4">
                  <Icon className="h-4 w-4 text-muted-foreground mt-0.5 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-sm font-medium text-foreground">
                        {action.title}
                      </span>
                      <Badge variant="outline">{action.tag}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {action.description}
                    </p>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      </section>
    </div>
  );
}
