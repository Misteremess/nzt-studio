# Changelog — NZT Studio

Cada entrada = un prompt del jefe. Explicación máx. 3 líneas.

**Versionado:** major = sprint/ruptura · minor = issue NZT-xx · patch = ajuste menor.

---

## 1.0.0 (IgnacioSanchezYuste)
**Sistema de agentes y PM.** Creado `CLAUDE.md` que autoconciba a Claude como Project Manager de NZT Studio al iniciar.
8 agentes sonnet en `.claude/agents/`: backend, frontend, database, ai, cybersecurity, qa, devops, product-strategist.

## 1.1.0 (IgnacioSanchezYuste)
**NZT-16 — UI base + dashboard privado.** Inicializado shadcn/ui (preset base-nova, tema oscuro forzado, Geist conectado a tokens). Creado shell privado `app/(private)/` con sidebar de 9 módulos + topbar (avatar, notificaciones).
Dashboard con 4 KPI cards (placeholder `—`), actividad reciente y próximos pasos (NZT-18/19/20). `/` redirige a `/dashboard`. ✅ tsc + lint + build.

## 1.1.1 (IgnacioSanchezYuste)
**CLAUDE.md — política de changelog.** Nueva sección 7 que obliga al PM a añadir una entrada al CHANGELOG tras cada prompt con cambios, con formato, versionado semver y reglas de cuándo NO escribir. Renumerada sección 8 (Memoria) y 9 (Comandos).


