# NZT Studio — Documentación Técnica

> Sprint 1 completado · v0.1.0 · Última actualización: 2026-05-24

---

## Índice

1. [Producto](#1-producto)
2. [Stack técnico](#2-stack-técnico)
3. [Estructura de archivos](#3-estructura-de-archivos)
4. [Arquitectura de la aplicación](#4-arquitectura-de-la-aplicación)
5. [Sistema de autenticación](#5-sistema-de-autenticación)
6. [Base de datos](#6-base-de-datos)
7. [Sistema visual](#7-sistema-visual)
8. [Variables de entorno](#8-variables-de-entorno)
9. [Scripts disponibles](#9-scripts-disponibles)
10. [Historial de tareas (Sprint 1)](#10-historial-de-tareas-sprint-1)
11. [Decisiones técnicas relevantes](#11-decisiones-técnicas-relevantes)
12. [Próximos pasos](#12-próximos-pasos)

---

## 1. Producto

**NZT Studio** es una plataforma privada de productividad impulsada por IA para:

- Analizar mercados y pymes
- Detectar oportunidades digitales vendibles
- Generar MVPs base y especificaciones técnicas
- Crear propuestas comerciales y presupuestos
- Gestionar proyectos en delivery

**No es un SaaS público.** Es una herramienta de uso personal, privado, de un solo usuario. No hay registro público, ni multiusuario, ni facturación.

### Flujo principal

```
Mercado → Empresa → Análisis → Oportunidad → MVP Spec → Propuesta → Proyecto → Entrega
```

---

## 2. Stack técnico

### Runtime y framework

| Tecnología | Versión | Rol |
|---|---|---|
| Next.js | 16.2.6 | Framework fullstack con App Router |
| React | 19.2.4 | UI runtime |
| TypeScript | ^5 | Tipado estricto (`strict: true`) |
| Node.js | ≥20 | Runtime de servidor |

### Estilos

| Tecnología | Versión | Rol |
|---|---|---|
| Tailwind CSS | ^4 | CSS utility-first, configuración CSS-first |
| shadcn/ui | Manual | Componentes base (Button, Card, Badge, Separator, Input, Label) |
| Geist Sans / Mono | vía Google Fonts | Tipografía |

### Base de datos

| Tecnología | Versión | Rol |
|---|---|---|
| PostgreSQL | (Neon cloud) | Base de datos principal |
| Prisma | ^7.8.0 | ORM |
| `@prisma/client` | ^7.8.0 | Cliente generado |
| `@prisma/adapter-pg` | ^7.8.0 | Adapter para conexión directa (requerido por Prisma 7) |
| `pg` | ^8.21.0 | Driver Node.js para PostgreSQL |
| Neon | cloud | Proveedor PostgreSQL serverless (eu-west-2) |

### Autenticación

| Tecnología | Versión | Rol |
|---|---|---|
| NextAuth (Auth.js) | 5.0.0-beta.31 | Autenticación privada |
| CredentialsProvider | — | Valida email/password vs variables de entorno |

### Utilidades

| Paquete | Rol |
|---|---|
| `clsx` + `tailwind-merge` | Combinación de clases CSS (`cn()`) |
| `class-variance-authority` | Variantes de componentes (CVA) |
| `lucide-react` | Iconografía |
| `@radix-ui/react-slot` | Composición (Button `asChild`) |
| `@radix-ui/react-separator` | Separador accesible |
| `dotenv` | Carga de `.env.local` en Prisma CLI |

---

## 3. Estructura de archivos

```
nzt-studio/
│
├── app/                          # Next.js App Router
│   ├── (private)/                # Route group privado — requiere sesión
│   │   ├── layout.tsx            # PrivateLayout: verifica auth + renderiza AppShell
│   │   ├── dashboard/page.tsx    # Dashboard principal
│   │   ├── companies/page.tsx
│   │   ├── market-intelligence/page.tsx
│   │   ├── company-analyzer/page.tsx
│   │   ├── opportunity-engine/page.tsx
│   │   ├── mvp-factory/page.tsx
│   │   ├── pricing-studio/page.tsx
│   │   ├── proposal-builder/page.tsx
│   │   ├── delivery-workspace/page.tsx
│   │   └── knowledge-base/page.tsx
│   │
│   ├── api/auth/[...nextauth]/
│   │   └── route.ts              # Handlers GET/POST de NextAuth
│   │
│   ├── login/
│   │   └── page.tsx              # Página de login (pública)
│   │
│   ├── globals.css               # Variables CSS + Tailwind v4 (@theme inline)
│   ├── layout.tsx                # Root layout (fuentes, metadata)
│   └── page.tsx                  # Raíz — redirect a /dashboard
│
├── auth.config.ts                # Config Edge-compatible para proxy.ts
├── auth.ts                       # Config completa con CredentialsProvider (Node.js)
├── proxy.ts                      # Next.js 16 proxy — protección de rutas a nivel Edge
│
├── components/
│   ├── auth/
│   │   └── login-form.tsx        # Formulario de login (client component)
│   ├── layout/
│   │   ├── app-shell.tsx         # Shell principal: Sidebar + Header + main
│   │   ├── sidebar.tsx           # Navegación lateral (client — usePathname)
│   │   └── private-header.tsx    # Header superior con título y logout
│   └── ui/
│       ├── badge.tsx
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       ├── label.tsx
│       └── separator.tsx
│
├── db/
│   └── prisma.ts                 # Singleton PrismaClient con patrón anti-hot-reload
│
├── features/                     # Módulos de negocio (scaffolded, sin lógica todavía)
│   ├── companies/
│   ├── company-analyzer/
│   ├── dashboard/
│   ├── delivery-workspace/
│   ├── knowledge-base/
│   ├── market-intelligence/
│   ├── mvp-factory/
│   ├── opportunity-engine/
│   ├── pricing-studio/
│   └── proposal-builder/
│
├── lib/
│   ├── constants.ts              # Constantes globales (APP_NAME, ROUTES)
│   └── utils.ts                  # cn(), formatDate(), formatCurrency()
│
├── prisma/
│   ├── schema.prisma             # Schema Prisma (11 modelos, 9 enums)
│   └── migrations/               # Historial de migraciones SQL
│
├── prisma.config.ts              # Config Prisma CLI (carga .env.local vía dotenv)
├── components.json               # Config shadcn/ui
├── tsconfig.json                 # TypeScript strict, path alias @/* → ./*
├── package.json
├── .env.example                  # Template de variables (commiteable, sin secretos)
└── .env.local                    # Variables reales (gitignored)
```

---

## 4. Arquitectura de la aplicación

### App Router y Server Components

El proyecto usa **React Server Components (RSC) por defecto**. Los Client Components (`"use client"`) solo se usan cuando hay interactividad o hooks:

| Archivo | Tipo | Motivo |
|---|---|---|
| `app/(private)/layout.tsx` | Server | Llama a `auth()` server-side |
| `app/(private)/dashboard/page.tsx` | Server | Sin interactividad |
| `app/login/page.tsx` | Server | Verifica sesión con `auth()` |
| `components/layout/app-shell.tsx` | Server | Solo estructura |
| `components/layout/sidebar.tsx` | **Client** | `usePathname()` para estado activo |
| `components/layout/private-header.tsx` | **Client** | `usePathname()` + `signOut()` |
| `components/auth/login-form.tsx` | **Client** | Estado de form + `signIn()` |

### Layout y navegación

```
app/layout.tsx (root — fuentes, meta)
└── app/(private)/layout.tsx (auth check)
    └── AppShell
        ├── Sidebar (navegación a 10 módulos)
        ├── PrivateHeader (título dinámico + logout)
        └── <main> (contenido de la página)
```

### Flujo de una request autenticada

```
Browser → proxy.ts (Edge)
            ↓ auth.config.ts: authorized()
            ↓ sesión válida
         → app/(private)/layout.tsx
            ↓ auth() server-side (segunda capa)
            ↓ sesión válida
         → AppShell + página renderizada
```

### Flujo de una request sin sesión

```
Browser → proxy.ts (Edge)
            ↓ auth.config.ts: authorized() → false
         → redirect /login (antes de cargar la página)
```

### Path alias

```json
// tsconfig.json
"paths": { "@/*": ["./*"] }
```

Todos los imports usan `@/` como raíz del proyecto. No existe carpeta `src/`.

---

## 5. Sistema de autenticación

### Estrategia

**NextAuth v5 (Auth.js) + CredentialsProvider + JWT sessions.**

- Sin base de datos de usuarios. Las credenciales se validan contra variables de entorno.
- Sin registro público. Solo el usuario configurado en `.env.local` puede acceder.
- Sesiones JWT sin estado (stateless) — no requieren tabla en la BD.
- Un solo usuario administrador por instancia.

### Archivos clave

#### `auth.config.ts` — Edge runtime

```
Edge-compatible. Sin CredentialsProvider.
Contiene: pages (signIn: "/login") + callback authorized().
Usado por proxy.ts.
```

El callback `authorized` decide si una request puede continuar:
- `/login` → permitido para no autenticados, redirect a `/dashboard` si ya autenticado.
- Todo lo demás → requiere sesión. Si no hay, NextAuth redirige a `/login`.

#### `auth.ts` — Node.js runtime

```
Extiende auth.config.ts añadiendo CredentialsProvider.
Exporta: handlers, auth, signIn, signOut.
Usado por: API route, layout privado, login page.
```

La función `authorize` en CredentialsProvider:
1. Lee `PRIVATE_ADMIN_EMAIL` y `PRIVATE_ADMIN_PASSWORD` del entorno.
2. Compara con las credenciales recibidas del formulario.
3. Devuelve el objeto usuario o `null`.

#### `proxy.ts` — Next.js 16 proxy

```
Reemplaza middleware.ts (deprecado en Next.js 16).
Exporta auth de NextAuth(authConfig) como default.
Matcher excluye /api/auth, _next/static, _next/image, favicon.ico.
```

### Protección de rutas — doble capa

| Capa | Archivo | Runtime | Cuándo actúa |
|---|---|---|---|
| 1ª | `proxy.ts` | Edge | Antes de cargar la página (más rápido) |
| 2ª | `app/(private)/layout.tsx` | Node.js | Durante el render del layout |

La doble capa garantiza que aunque el proxy falle o sea omitido, el layout siempre verifica la sesión.

### Logout

El botón "Salir" en `PrivateHeader` llama a `signOut({ callbackUrl: "/login" })` de `next-auth/react`, que invalida la cookie JWT y redirige al login.

---

## 6. Base de datos

### Proveedor

**Neon** — PostgreSQL serverless en `eu-west-2` (AWS). Free tier.

Conexión directa (sin pooler) para evitar incompatibilidades con migraciones DDL en PgBouncer.

### ORM: Prisma 7

**Cambios importantes de Prisma 7 vs versiones anteriores:**

1. La propiedad `url` en `datasource db` del schema fue **eliminada**. La URL de conexión para el CLI va en `prisma.config.ts`.
2. El runtime del cliente requiere un **driver adapter** (`@prisma/adapter-pg`) — no lee `DATABASE_URL` automáticamente.
3. Coexisten dos configuraciones: `prisma.config.ts` (para el CLI) y `db/prisma.ts` (para el runtime).

### `prisma.config.ts` — CLI

```typescript
config({ path: ".env.local" }); // carga .env.local para prisma migrate dev
defineConfig({
  schema: "prisma/schema.prisma",
  migrations: { path: "prisma/migrations" },
  datasource: { url: process.env.DATABASE_URL }, // para el CLI
});
```

### `db/prisma.ts` — Runtime

```typescript
// Patrón singleton anti-hot-reload (Next.js dev mode crea múltiples instancias)
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL! });
export const prisma = globalForPrisma.prisma ?? new PrismaClient({ adapter });
if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
```

**Uso en Server Components:**
```typescript
import { prisma } from "@/db/prisma";
const companies = await prisma.company.findMany();
```

### Schema — modelos

#### Flujo del dominio

```
MarketResearch (independiente)

Company
  ├── Analysis ──→ AiRun
  │       └──→ Opportunity ──→ MvpSpec
  │                   └──────────┴──→ Proposal
  │                                       └──→ Project
  │                                               └──→ Task
  └── (relaciones directas con Opportunity, Proposal, Project)

PromptTemplate ──→ AiRun
KnowledgeItem (independiente)
```

#### Tabla de modelos

| Modelo | Tabla PostgreSQL | Descripción |
|---|---|---|
| `SystemHealthCheck` | `system_health_checks` | Validación técnica NZT-18 |
| `Company` | `companies` | Empresa candidata |
| `MarketResearch` | `market_researches` | Análisis de mercado/nicho |
| `Analysis` | `analyses` | Auditoría de empresa |
| `Opportunity` | `opportunities` | Oportunidad vendible |
| `MvpSpec` | `mvp_specs` | Especificación de MVP |
| `Proposal` | `proposals` | Propuesta comercial |
| `Project` | `projects` | Proyecto en delivery |
| `Task` | `tasks` | Tarea de proyecto |
| `PromptTemplate` | `prompt_templates` | Prompt versionado |
| `AiRun` | `ai_runs` | Ejecución de IA (trazabilidad) |
| `KnowledgeItem` | `knowledge_items` | Base de conocimiento |

#### Enums

| Enum | Valores |
|---|---|
| `CompanyStatus` | `PROSPECT`, `ACTIVE`, `PROPOSAL_SENT`, `CLIENT`, `INACTIVE` |
| `OpportunityStatus` | `DETECTED`, `VALIDATED`, `PROPOSED`, `ACCEPTED`, `REJECTED`, `CLOSED` |
| `ProposalStatus` | `DRAFT`, `SENT`, `ACCEPTED`, `REJECTED`, `EXPIRED` |
| `ProjectStatus` | `PLANNING`, `IN_PROGRESS`, `ON_HOLD`, `COMPLETED`, `CANCELLED` |
| `TaskStatus` | `TODO`, `IN_PROGRESS`, `DONE`, `BLOCKED` |
| `TaskPriority` | `LOW`, `MEDIUM`, `HIGH`, `CRITICAL` |
| `PromptTemplateType` | `ANALYSIS`, `OPPORTUNITY`, `MVP_SPEC`, `PROPOSAL`, `PRICING`, `KNOWLEDGE`, `GENERAL` |
| `AiRunType` | `ANALYSIS`, `OPPORTUNITY_DETECTION`, `MVP_SPEC_GENERATION`, `PROPOSAL_GENERATION`, `PRICING`, `GENERAL` |
| `KnowledgeItemType` | `TEMPLATE`, `PROMPT`, `GUIDE`, `REFERENCE`, `CASE_STUDY`, `SNIPPET` |

#### Decisiones de tipado en el schema

| Tipo | Campos | Motivo |
|---|---|---|
| `Json` | `rawData`, `scores`, `aiOutput`, `features`, `screens`, `dataSchema`, `roadmap`, `content`, `findings`, `ideas`, `input`, `output`, `outputSchema`, `embedding` | Estructura variable; cambia con cada iteración de IA o negocio |
| `Decimal(10,2)` | Precios en EUR (`price`, `maintenancePrice`) | Evita errores de punto flotante financiero |
| `Decimal(10,6)` | `AiRun.cost` | Precisión sub-céntimo para costes de API de IA |
| `String[]` | `KnowledgeItem.tags` | Array nativo PostgreSQL (`TEXT[]`), sin tabla intermedia |
| `String` | `Opportunity.difficulty` | Flexibilidad inicial; `"low" \| "medium" \| "high"` |

#### Comportamiento de borrado (onDelete)

| Relación | Comportamiento | Motivo |
|---|---|---|
| `Analysis → Company` | `Cascade` | Un análisis sin empresa no tiene sentido |
| `Opportunity → Company` | `Cascade` | Idem |
| `Proposal → Company` | `Cascade` | Idem |
| `Project → Company` | `Cascade` | Idem |
| `Task → Project` | `Cascade` | Las tareas son parte del proyecto |
| `MvpSpec → Opportunity` | `Cascade` | El spec depende de la oportunidad |
| `Opportunity → Analysis` | `SetNull` | La oportunidad puede existir sin análisis |
| `Proposal → Opportunity` | `SetNull` | La propuesta puede desvincularse |
| `Proposal → MvpSpec` | `SetNull` | Idem |
| `Project → Proposal` | `SetNull` | El proyecto puede desvincularse de la propuesta |
| `AiRun → PromptTemplate` | `SetNull` | Un run puede ser ad hoc (sin template) |
| `AiRun → Analysis` | `SetNull` | Futuro: runs para pricing, proposals, etc. |

#### Índices únicos

```sql
UNIQUE INDEX projects_proposalId_key ON projects(proposalId)
-- Un proyecto por propuesta

UNIQUE INDEX prompt_templates_name_version_key ON prompt_templates(name, version)
-- Versiones únicas de prompts
```

#### Migraciones aplicadas

| Migración | Fecha | Descripción |
|---|---|---|
| `20260523223237_init` | 2026-05-23 | Tabla `system_health_checks` (NZT-18) |
| `20260523224221_initial_schema` | 2026-05-23 | 9 enums + 11 tablas de negocio (NZT-19) |

---

## 7. Sistema visual

### Tailwind CSS v4

El proyecto usa **Tailwind v4** con configuración CSS-first. No existe `tailwind.config.ts`. Toda la configuración vive en `app/globals.css` usando directivas `@theme`.

```css
@import "tailwindcss";

:root {
  /* Variables semánticas HSL */
  --background: 240 10% 3.9%;    /* zinc-950 */
  --foreground: 0 0% 98%;
  --card: 240 5.9% 10%;          /* zinc-900 */
  --primary: 239 84% 67%;        /* indigo-500 */
  --border: 240 3.7% 15.9%;     /* zinc-800 */
  /* ... */
}

@theme inline {
  /* Expone variables como utilities de Tailwind */
  --color-background: hsl(var(--background));
  --color-primary: hsl(var(--primary));
  /* ... */
}
```

Las clases como `bg-background`, `text-primary`, `border-border` funcionan porque están definidas en `@theme inline`.

### Paleta

| Token | Color | Uso |
|---|---|---|
| `background` | zinc-950 (`#09090b`) | Fondo principal |
| `card` | zinc-900 (`#18181b`) | Cards, sidebar, header |
| `border` | zinc-800 (`#27272a`) | Bordes |
| `muted-foreground` | zinc-400 | Texto secundario |
| `primary` | indigo-500 | Rutas activas, botones, accent |
| `destructive` | red-600 | Errores |

### shadcn/ui

Configurado en `components.json`. Los componentes están implementados manualmente (no via CLI) para evitar conflictos con Tailwind v4:

```
components/ui/
  button.tsx    — variantes via CVA (default, outline, ghost, secondary, link)
  card.tsx      — Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter
  badge.tsx     — variantes (default, secondary, outline, destructive)
  separator.tsx — Radix UI Separator
  input.tsx     — input nativo estilizado
  label.tsx     — label nativo estilizado
```

### AppShell

```
┌─────────────────────────────────────────────┐
│  Sidebar (w-56, fixed)  │  Header (h-14)    │
│                         ├───────────────────┤
│  - NZT Studio           │  <main>           │
│  - Private AI Venture   │  (p-6, overflow)  │
│  ─────────────────────  │                   │
│  [Nav items x10]        │  Contenido        │
│  ─────────────────────  │  de la página     │
│  ● System active        │                   │
└─────────────────────────────────────────────┘
```

---

## 8. Variables de entorno

Todas van en `.env.local` (gitignored). Ver `.env.example` para el formato completo.

### Requeridas

| Variable | Descripción | Ejemplo |
|---|---|---|
| `DATABASE_URL` | Connection string de Neon | `postgresql://user:pass@ep-xxx.neon.tech/neondb?sslmode=require` |
| `AUTH_SECRET` | Secreto para firmar JWT de NextAuth | `openssl rand -base64 32` |
| `PRIVATE_ADMIN_EMAIL` | Email del usuario administrador | `admin@nztstudio.local` |
| `PRIVATE_ADMIN_PASSWORD` | Contraseña del administrador | string seguro |

### Opcionales

| Variable | Descripción | Default |
|---|---|---|
| `NEXT_PUBLIC_APP_URL` | URL de la app | `http://localhost:3000` |
| `AUTH_TRUST_HOST` | Confianza en el host para NextAuth | `true` (local/self-hosted) |

### Pendientes (próximos sprints)

| Variable | Sprint |
|---|---|
| `ANTHROPIC_API_KEY` | NZT-21+ |
| `OPENAI_API_KEY` | NZT-21+ |

---

## 9. Scripts disponibles

```bash
# Desarrollo
npm run dev           # Inicia Next.js en modo desarrollo (puerto 3000)

# Build y producción
npm run build         # Build de producción con Turbopack
npm run start         # Inicia servidor de producción

# Linting
npm run lint          # ESLint sobre todo el proyecto

# Base de datos
npm run db:generate   # Regenera Prisma Client desde el schema
npm run db:migrate    # Aplica migraciones pendientes (pide nombre)
npm run db:studio     # Abre Prisma Studio en el navegador
npm run db:push       # Push del schema sin crear migración (solo dev)

# Automático
# postinstall: prisma generate (se ejecuta tras npm install)
```

---

## 10. Historial de tareas (Sprint 1)

### NZT-13 — Inicializar proyecto Next.js

**Commit:** `4db77da`

- Proyecto creado con `create-next-app`
- TypeScript strict
- Tailwind CSS
- App Router

### NZT-14 — Estructura de carpetas

**Commit:** `60d237e`

- Estructura modular por features bajo `features/`
- Route group `app/(private)/` con páginas placeholder para los 10 módulos
- Carpetas `lib/`, `db/`, `services/`, `hooks/`, `types/`, `config/`
- Utilidades globales: `cn()`, `formatDate()`, `formatCurrency()`
- Constantes y configuración central

### NZT-15 — README inicial

**Commit:** `e292cb9`

- README con stack, estructura y convenciones
- Documentación de módulos en `docs/MODULES.md`
- Notas de arquitectura en `docs/ARCHITECTURE.md`

### NZT-16 + NZT-17 — UI base y estilos globales

**Commit:** `31111db`

**UI base (NZT-16):**
- `AppShell` — layout reutilizable con Sidebar + Header + main
- `Sidebar` — navegación lateral real con 10 módulos, iconos lucide, estado activo vía `usePathname()`
- `PrivateHeader` — título dinámico según ruta
- Dashboard con cards de estado, módulos principales y próximas acciones
- Root page (`/`) redirige a `/dashboard`

**Estilos (NZT-17):**
- shadcn/ui configurado (Button, Card, Badge, Separator)
- `globals.css` reescrito con tokens CSS semánticos vía `@theme inline`
- Paleta dark-first: zinc + indigo-500 como accent
- Focus visible, antialiasing, fuentes Geist

### NZT-18 — Base de datos y ORM

**Commits:** `f58d60d`, `279ef03`

- Instalación de Prisma 7.8.0 + `@prisma/client` + `@prisma/adapter-pg` + `pg`
- `prisma.config.ts` — carga `.env.local` via `dotenv` para que el CLI y Next.js compartan `DATABASE_URL`
- `db/prisma.ts` — singleton `PrismaClient` con `PrismaPg` adapter (requerido por Prisma 7)
- Schema inicial con `SystemHealthCheck` para validar conexión
- Primera migración aplicada en Neon: tabla `system_health_checks`
- Scripts `db:generate`, `db:migrate`, `db:studio`, `db:push`
- `postinstall: prisma generate`
- `.env.example` añadido al repo (fix del `.gitignore` que ignoraba `.env*`)

### NZT-19 — Schema inicial de datos

**Commit:** `4229e8e`

- 9 enums de dominio
- 11 modelos Prisma cubriendo el flujo completo:
  `Company → Analysis → Opportunity → MvpSpec → Proposal → Project → Task`
  + `MarketResearch`, `PromptTemplate`, `AiRun`, `KnowledgeItem`
- `Decimal(10,2)` para precios en EUR
- `Decimal(10,6)` para costes de IA
- `String[]` para tags (array nativo PostgreSQL)
- `Json` para outputs variables de IA
- `embedding Json?` placeholder para pgvector futuro
- Migracion `20260523224221_initial_schema` aplicada en Neon

### NZT-20 — Acceso privado

**Commit:** `405ca0c`

- NextAuth v5 (Auth.js) con CredentialsProvider + JWT sessions
- Split config: `auth.config.ts` (Edge) + `auth.ts` (Node.js)
- `proxy.ts` — Next.js 16 proxy (reemplaza `middleware.ts` deprecado)
- Doble capa de protección: proxy (Edge) + layout server-side
- Pantalla de login (`/login`) con form, manejo de errores y redirect
- Botón "Salir" en header con `signOut()` de `next-auth/react`
- Componentes `Input` y `Label` añadidos a `components/ui/`
- Variables de entorno: `AUTH_SECRET`, `AUTH_TRUST_HOST`, `PRIVATE_ADMIN_EMAIL`, `PRIVATE_ADMIN_PASSWORD`

---

## 11. Decisiones técnicas relevantes

### Tailwind v4: CSS-first, sin config file

Tailwind v4 eliminó `tailwind.config.ts`. Toda la configuración (colores, radio, fuentes) se define en CSS con `@theme`. Consecuencia: los componentes shadcn/ui se implementaron manualmente (el CLI de shadcn asume Tailwind v3).

### Prisma 7: adapter pattern obligatorio

Prisma 7 eliminó la lectura automática de `DATABASE_URL` desde el schema. El cliente de runtime **requiere** un driver adapter. Se eligió `@prisma/adapter-pg` (genérico, no atado a Neon). La URL del CLI va en `prisma.config.ts`.

Esta arquitectura tiene dos configuraciones:
- `prisma.config.ts` → para `prisma migrate dev`, `prisma studio`
- `db/prisma.ts` (con adapter) → para el runtime de la app

### Next.js 16: proxy en lugar de middleware

Next.js 16 deprecó la convención `middleware.ts` en favor de `proxy.ts`. El archivo tiene la misma posición (raíz del proyecto) pero el naming cambió. El export es un `default function`.

### NextAuth v5: split config para Edge compatibility

El middleware/proxy corre en Edge runtime (no Node.js). `CredentialsProvider` de NextAuth requiere Node.js. Por eso existen dos archivos:
- `auth.config.ts` — solo el callback `authorized`, sin providers. Compatible con Edge.
- `auth.ts` — extiende `auth.config.ts` añadiendo `CredentialsProvider`. Solo corre en Node.js.

### Autenticación via env vars (MVP privado)

Las credenciales se validan contra `PRIVATE_ADMIN_EMAIL` y `PRIVATE_ADMIN_PASSWORD` en `.env.local`. No hay tabla de usuarios en la BD. Esta decisión:
- Elimina la necesidad de gestión de usuarios para el MVP
- Permite evolución futura: añadir Prisma adapter a NextAuth y tabla `User` sin cambiar la lógica de rutas
- Es segura para uso privado (contraseña en archivo gitignored, JWT firmado con `AUTH_SECRET`)

### Json para outputs de IA

Los campos que almacenan outputs de modelos de IA (`rawData`, `aiOutput`, `features`, `screens`, `roadmap`, `content`, etc.) usan `Json` (JSONB en PostgreSQL). Motivo: la estructura de estos campos evoluciona con el prompt y el modelo. Normalizar prematuramente sería sobreingeniería.

### Sin src/

El proyecto no usa carpeta `src/`. Los archivos viven en la raíz: `app/`, `components/`, `lib/`, `db/`, `features/`. El alias `@/*` apunta a `./` (raíz).

---

## 12. Próximos pasos

### Sprint 2 — CRM privado

| Tarea | Descripción |
|---|---|
| NZT-21 | CRUD de empresas (Companies module) |
| NZT-22 | Listado paginado con filtros |
| NZT-23 | Vista detalle de empresa |
| NZT-24 | Formulario de creación/edición |

### Sprint 3 — Analizador web básico

| Tarea | Descripción |
|---|---|
| NZT-25 | Scraping básico de sitio web |
| NZT-26 | Análisis de SEO y rendimiento |
| NZT-27 | Guardado de análisis en BD |

### Sprint 4 — Diagnóstico con IA

| Tarea | Descripción |
|---|---|
| NZT-28 | Integración Anthropic API |
| NZT-29 | Prompt para diagnóstico de empresa |
| NZT-30 | Guardado de `AiRun` y `Analysis.aiOutput` |

### Sprint 5+ — Opportunity Engine, MVP Factory, Proposal Builder

Flujo completo: Oportunidad detectada → especificación MVP → propuesta generada.

### Pendientes técnicos

- **pgvector** — soporte para embeddings en `KnowledgeItem.embedding` (actualmente `Json?`)
- **Contraseña hasheada** — `PRIVATE_ADMIN_PASSWORD` actualmente en texto plano comparado con `===`. Añadir `bcrypt` cuando se migre a usuarios en BD
- **Connection pooling** — añadir pooler URL de Neon para producción con tráfico real
- **Email de recuperación** — si se añaden más usuarios, necesitarán recuperación de acceso
- **Seeds de datos de prueba** — para desarrollo y testing

---

*Documentación generada el 2026-05-24 · NZT Studio v0.1.0*
