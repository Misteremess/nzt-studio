<!-- docs/ARCHITECTURE.md -->
# NZT Studio — Architecture Notes

## Stack
- Next.js (App Router)
- TypeScript strict
- Tailwind CSS
- PostgreSQL + Prisma (Sprint 2)
- Auth privada (Sprint 2)
- IA multi-modelo (Sprint 3+)

## Feature modules
- features/companies/
- features/analyses/
- features/opportunities/
- features/mvp-specs/
- features/proposals/
- features/ai/

## Conventions
- Server Components by default
- Client Components only when needed (interactivity, hooks)
- Server Actions for mutations
- Types in types/ or colocated in feature