# syntax=docker/dockerfile:1

# ─── Stage 1: build ──────────────────────────────────────────────────────────
# Instala todas las dependencias, genera el cliente Prisma y compila Next.
FROM node:22-alpine AS builder
WORKDIR /app

# openssl/libc6-compat: requeridos por los motores de Prisma en Alpine (musl).
RUN apk add --no-cache libc6-compat openssl

# Copiar manifiestos + esquema antes de instalar: el postinstall ejecuta
# `prisma generate`, que necesita prisma/schema.prisma presente.
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

# Código fuente y build.
COPY . .

# Valores de build (NO se usan en runtime — ahí los provee docker-compose).
# Prisma instancia el cliente al importar db/prisma.ts durante el build, por eso
# necesita una DATABASE_URL con formato válido (no conecta hasta ejecutar query).
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder"
ENV AUTH_TRUST_HOST="true"
ENV TOTP_ENCRYPTION_KEY="build-time-placeholder"
ENV NEXT_PUBLIC_APP_URL="http://localhost:3000"
RUN npm run build

# ─── Stage 2: runner ─────────────────────────────────────────────────────────
# Imagen de ejecución. Lleva node_modules completo (incluye el CLI de Prisma para
# `migrate deploy` en el arranque) + la build de Next.
FROM node:22-alpine AS runner
WORKDIR /app

RUN apk add --no-cache libc6-compat openssl curl
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN addgroup -S nodejs && adduser -S nextjs -G nodejs

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

RUN chmod +x ./docker-entrypoint.sh && chown -R nextjs:nodejs /app
USER nextjs

EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
