# NZT Studio

Plataforma privada de productividad con IA para analizar pymes, detectar oportunidades de negocio digitales, diseñar MVPs, generar propuestas comerciales y acelerar la producción de proyectos web/software.

> Herramienta de uso interno. No es un SaaS público.

---

## Stack técnico

| Capa | Tecnología |
|---|---|
| Framework | Next.js 14+ (App Router) |
| Lenguaje | TypeScript (strict) |
| Estilos | Tailwind CSS |
| Componentes UI | shadcn/ui (Sprint 1) |
| Base de datos | PostgreSQL |
| ORM | Prisma |
| Autenticación | Auth privada (Sprint 2) |
| IA | Multi-modelo: OpenAI, Anthropic (Sprint 3+) |
| Análisis web | Fetch + parsing básico → Playwright + Lighthouse (futuro) |

---

## Requisitos previos

- Node.js 20 LTS o superior
- npm 10+
- PostgreSQL (Sprint 2+)

---

## Instalación y desarrollo

```bash
# 1. Clonar el repositorio
git clone <repo-url>
cd nzt-studio

# 2. Instalar dependencias
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local con los valores reales

# 4. Arrancar en desarrollo
npm run dev
```

La app estará disponible en `http://localhost:3000`.

### Comandos disponibles

```bash
npm run dev        # Servidor de desarrollo
npm run build      # Build de producción
npm run start      # Servidor de producción
npm run lint       # Linter
npx tsc --noEmit   # Comprobación de tipos
```

---

## Estructura de carpetas

nzt-studio/
├── app/                    # Rutas y layouts (Next.js App Router)
│   ├── layout.tsx          # Layout raíz
│   └── page.tsx            # Página de inicio
│
├── components/             # Componentes UI reutilizables y genéricos
│
├── features/               # Módulos de negocio (un módulo por dominio)
│   ├── companies/          # Gestión de empresas analizadas
│   ├── analyses/           # Análisis web de empresas
│   ├── opportunities/      # Oportunidades detectadas
│   ├── mvp-specs/          # Especificaciones de MVPs
│   ├── proposals/          # Propuestas comerciales y presupuestos
│   └── ai/                 # Capa de integración con IA
│
├── lib/                    # Utilidades y helpers compartidos
├── services/               # Integraciones con servicios externos
├── types/                  # Tipos e interfaces globales de TypeScript
├── config/                 # Constantes y configuración de la aplicación
├── docs/                   # Documentación técnica interna
│
├── .env.example            # Plantilla de variables de entorno
├── .env.local              # Variables locales (no commitear)
├── next.config.ts
├── tailwind.config.ts
├── tsconfig.json
└── package.json

---

## Convenciones

### TypeScript
- Modo estricto activado (`strict: true`).
- Sin `any`. Usar tipos explícitos o `unknown` con narrowing.
- Sin `allowJs`. Todo el código en TypeScript.

### Componentes
- Server Components por defecto.
- `"use client"` solo cuando sea estrictamente necesario (interactividad, hooks del browser).
- Componentes pequeños y con responsabilidad única.
- Nombrar con PascalCase: `CompanyCard.tsx`.

### Features
- Cada módulo en `features/` es autónomo: contiene sus propios componentes, acciones, tipos y servicios si los necesita.
- La lógica de negocio vive en `features/`, no en `app/` ni en componentes de UI.

### Server Actions
- Las mutaciones de datos se implementan como Server Actions.
- Validar siempre las entradas antes de persistir.
- Nunca exponer lógica sensible en el cliente.

### Variables de entorno
- Las variables públicas (expuestas al cliente) usan el prefijo `NEXT_PUBLIC_`.
- Las variables privadas (claves de API, base de datos) nunca llevan ese prefijo.
- Documentar toda variable nueva en `.env.example` antes de usarla.

### Commits
- Formato semántico: `tipo(scope): descripción`.
- Tipos: `feat`, `fix`, `chore`, `refactor`, `docs`, `test`.
- Ejemplo: `feat(NZT-14): add global types and config structure`.

### Nomenclatura de archivos
- Componentes: `PascalCase.tsx`
- Utilidades, hooks, servicios: `camelCase.ts`
- Rutas de Next.js: `kebab-case/` (carpetas) y `page.tsx`, `layout.tsx` (archivos reservados)

---

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar los valores:

```bash
cp .env.example .env.local
```

Nunca commitear `.env.local`. Está incluido en `.gitignore`.

---

## Estado del proyecto

| Sprint | Objetivo | Estado |
|---|---|---|
| Sprint 1 | Base técnica, estructura, acceso privado, dashboard base | 🟡 En progreso |
| Sprint 2 | Base de datos, Prisma, gestión de empresas | ⬜ Pendiente |
| Sprint 3 | Análisis web básico, detección de oportunidades | ⬜ Pendiente |
| Sprint 4+ | IA, MVPs, propuestas, automatización | ⬜ Pendiente |

---

## Documentación interna

La documentación técnica detallada está en `/docs`:

- `docs/ARCHITECTURE.md` — Decisiones de arquitectura