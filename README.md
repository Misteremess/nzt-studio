# NZT Studio

Plataforma privada de productividad con IA para analizar pymes, detectar oportunidades de negocio digitales, diseñar MVPs, generar propuestas comerciales y acelerar la producción de proyectos web/software.

> Herramienta de uso interno. No es un SaaS público.

---

## Stack técnico

| Capa | Tecnología | Versión |
|---|---|---|
| Framework | Next.js (App Router) | 16.2.6 |
| Lenguaje | TypeScript (strict) | ^5 |
| Estilos | Tailwind CSS v4 (CSS-first) | ^4 |
| Componentes UI | shadcn/ui (manual, compatible con Tailwind v4) | — |
| Base de datos | PostgreSQL — Neon cloud | — |
| ORM | Prisma | ^7.8.0 |
| Autenticación | NextAuth v5 (CredentialsProvider + JWT) | 5.0.0-beta.31 |
| IA | Multi-modelo: Anthropic, OpenAI (Sprint 4+) | — |
| Análisis web | Playwright + Lighthouse (Sprint 3+) | — |

---

## Requisitos previos

- Node.js 20 LTS o superior
- npm 10+
- Cuenta en [Neon](https://neon.tech) con un proyecto PostgreSQL activo

---

## Instalación

```bash
# 1. Clonar el repositorio
git clone https://github.com/Misteremess/nzt-studio.git
cd nzt-studio

# 2. Instalar dependencias (incluye prisma generate automático)
npm install

# 3. Configurar variables de entorno
cp .env.example .env.local
# Editar .env.local — ver sección "Variables de entorno" más abajo
```

---

## Configurar la base de datos

```bash
# Aplicar migraciones a Neon
npm run db:migrate
# Cuando pida nombre de migración, escribe algo como: "sprint_2_companies"

# (Opcional) Abrir Prisma Studio para inspeccionar las tablas
npm run db:studio
```

---

## Arrancar en desarrollo

```bash
npm run dev
# → http://localhost:3000
# → Redirige automáticamente a /login
```

Los usuarios viven en la tabla `users` (no hay admin por env). Crea una cuenta:

```bash
npm run users:create -- tu-email@dominio.com "Tu Nombre"
```

En el primer login configurarás el **2FA** escaneando un QR con Google
Authenticator. Más comandos: `npm run users:list`, `npm run users:reset-2fa -- <email>`.

---

## Scripts disponibles

```bash
npm run dev           # Servidor de desarrollo (puerto 3000)
npm run build         # Build de producción
npm run start         # Servidor de producción
npm run lint          # ESLint

npm run db:generate   # Regenera Prisma Client desde el schema
npm run db:migrate    # Aplica migraciones pendientes (dev)
npm run db:deploy     # Aplica migraciones en producción (prisma migrate deploy)
npm run db:studio     # Abre Prisma Studio en el navegador
npm run db:push       # Push del schema sin migración (solo exploración)

npm run users:create        # Crea un usuario: -- <email> <nombre> [password]
npm run users:list          # Lista los usuarios
npm run users:reset-2fa     # Reinicia el 2FA de un usuario: -- <email>
npm run users:reset-password # Cambia la contraseña: -- <email> [password]
```

> Despliegue en VPS (Docker + Nginx): ver [`DEPLOY.md`](DEPLOY.md).

---

## Variables de entorno

Copiar `.env.example` a `.env.local` y completar todos los valores:

```bash
cp .env.example .env.local
```

| Variable | Descripción | Cómo obtenerla |
|---|---|---|
| `DATABASE_URL` | Connection string de PostgreSQL | Neon → Connection Details → Connection string (sin pooler) |
| `AUTH_SECRET` | Secreto para firmar sesiones JWT | `openssl rand -base64 32` |
| `AUTH_TRUST_HOST` | Confianza en el host (necesario fuera de Vercel) | `true` |
| `TOTP_ENCRYPTION_KEY` | Cifra los secretos 2FA en reposo | `openssl rand -base64 32` |

> `.env.local` está en `.gitignore`. Nunca lo commitees.

---

## Estructura de carpetas

```
nzt-studio/
├── app/                          # Next.js App Router
│   ├── (private)/                # Rutas privadas — requieren sesión activa
│   │   ├── layout.tsx            # Layout privado con verificación de auth
│   │   ├── dashboard/
│   │   ├── companies/
│   │   ├── market-intelligence/
│   │   ├── company-analyzer/
│   │   ├── opportunity-engine/
│   │   ├── mvp-factory/
│   │   ├── pricing-studio/
│   │   ├── proposal-builder/
│   │   ├── delivery-workspace/
│   │   └── knowledge-base/
│   ├── api/auth/[...nextauth]/   # Handlers de NextAuth
│   ├── login/                    # Página de login (pública)
│   ├── globals.css               # Variables CSS + Tailwind v4
│   └── layout.tsx                # Layout raíz
│
├── auth.config.ts                # Config Edge-compatible (proxy)
├── auth.ts                       # Config completa con CredentialsProvider
├── proxy.ts                      # Protección de rutas a nivel Edge (Next.js 16)
│
├── components/
│   ├── auth/                     # LoginForm
│   ├── layout/                   # AppShell, Sidebar, PrivateHeader
│   └── ui/                       # Button, Card, Badge, Input, Label, Separator
│
├── db/
│   └── prisma.ts                 # Singleton PrismaClient con PrismaPg adapter
│
├── features/                     # Módulos de negocio (scaffolded)
│   ├── companies/
│   ├── company-analyzer/
│   ├── opportunity-engine/
│   ├── mvp-factory/
│   ├── pricing-studio/
│   ├── proposal-builder/
│   ├── delivery-workspace/
│   └── knowledge-base/
│
├── lib/
│   ├── utils.ts                  # cn(), formatDate(), formatCurrency()
│   └── constants.ts              # APP_NAME, ROUTES
│
├── prisma/
│   ├── schema.prisma             # 11 modelos, 9 enums
│   └── migrations/               # Historial de migraciones SQL
│
├── prisma.config.ts              # Config Prisma CLI
├── components.json               # Config shadcn/ui
└── docs/                         # Documentación técnica interna
```

---

## Convenciones

### TypeScript
- Modo estricto (`strict: true`). Sin `any`.
- Server Components por defecto. `"use client"` solo cuando haya interactividad o hooks del browser.

### Imports
- Alias `@/` apunta a la raíz del proyecto (no existe carpeta `src/`).
- Ejemplo: `import { prisma } from "@/db/prisma"`.

### Features
- Cada módulo en `features/` es autónomo: componentes, acciones, tipos y hooks propios.
- La lógica de negocio vive en `features/`, no en `app/` ni en `components/`.

### Server Actions
- Las mutaciones usan Server Actions de Next.js.
- Validar siempre las entradas antes de persistir.
- Nunca exponer lógica sensible al cliente.

### Commits
- Formato: `tipo(NZT-XX): descripción`.
- Tipos: `feat`, `fix`, `refactor`, `docs`, `chore`.

### Nomenclatura
- Componentes: `PascalCase.tsx`
- Utilidades, hooks, servicios: `camelCase.ts`
- Rutas: `kebab-case/` + archivos reservados Next.js (`page.tsx`, `layout.tsx`)

---

## Acceso privado

La app redirige a `/login` automáticamente si no hay sesión.

- **Sin registro público** — solo el usuario configurado en `.env.local` puede acceder.
- **Sin roles ni multiusuario** — single admin para uso personal.
- Tras login, la sesión dura 30 días (JWT firmado con `AUTH_SECRET`).
- El botón "Salir" en el header cierra la sesión y redirige a `/login`.

---

## Documentación interna

Documentación técnica detallada en `/docs`:

- [`docs/TECHNICAL.md`](docs/TECHNICAL.md) — Documentación completa de Sprint 1: stack, arquitectura, decisiones técnicas, schema de datos, auth, historial de tareas.
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) — Decisiones de arquitectura.
- [`docs/MODULES.md`](docs/MODULES.md) — Descripción de módulos funcionales.

---

## Estado del proyecto

| Sprint | Objetivo | Estado |
|---|---|---|
| Sprint 1 | Base técnica, UI privada, DB, schema, auth | ✅ Completado |
| Sprint 2 | CRM privado de empresas (CRUD) | 🔜 Siguiente |
| Sprint 3 | Análisis web básico | ⬜ Pendiente |
| Sprint 4+ | IA, diagnóstico, oportunidades, propuestas | ⬜ Pendiente |
