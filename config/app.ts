// config/app.ts
// Configuración central de la app — sin secretos aquí.

export const appConfig = {
  name: "NZT Studio",
  version: "0.1.0",
  locale: "es-ES",
  currency: "EUR",
  defaultPagination: 20,
} as const;