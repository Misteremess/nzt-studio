# Despliegue en VPS de Hostinger

Stack autocontenido con Docker Compose: **Postgres** + **app Next.js** + **Nginx**
(reverse proxy + TLS). Pensado para un VPS de Hostinger con Ubuntu.

---

## 1. Preparar el servidor (una sola vez)

Conéctate por SSH al VPS e instala Docker:

```bash
# Ubuntu — Docker Engine + Compose plugin
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER   # cierra y reabre la sesión SSH tras esto
```

Comprueba: `docker --version` y `docker compose version`.

## 2. Clonar el proyecto

```bash
git clone <URL-del-repo> nzt-studio
cd nzt-studio
```

## 3. Configurar variables de entorno

```bash
cp .env.production.example .env
nano .env
```

Rellena, como mínimo:

- `POSTGRES_PASSWORD` y `DATABASE_URL` (la contraseña debe coincidir en ambos).
- `AUTH_SECRET`, `TOTP_ENCRYPTION_KEY` → genera cada uno con:
  ```bash
  openssl rand -base64 32
  ```
- `NEXT_PUBLIC_APP_URL` y `AUTH_URL` → tu dominio (p. ej. `https://app.tudominio.com`).
- Las **API keys** (`ANTHROPIC_API_KEY`, `OPENAI_API_KEY`, `GEMINI_API_KEY`,
  `GOOGLE_PLACES_API_KEY`). Puedes dejarlas vacías al principio y rellenarlas
  después (ver §8).

> `.env` está en `.gitignore`: nunca se sube al repo.

## 4. Levantar el stack

```bash
docker compose up -d --build
```

Esto construye la imagen, arranca Postgres, **aplica las migraciones
automáticamente** (`prisma migrate deploy` en el arranque de la app) y levanta
Nginx en el puerto 80.

Comprueba el estado y los logs:

```bash
docker compose ps
docker compose logs -f app
```

## 5. Crear las cuentas de usuario

No hay registro público. Crea una cuenta para cada persona ejecutando el CLI
dentro del contenedor de la app:

```bash
docker compose exec app npm run users:create -- tu-email@dominio.com "Tu Nombre"
docker compose exec app npm run users:create -- email-companero@dominio.com "Nombre Compañero"
```

Cada comando imprime **una contraseña generada** (guárdala). Si prefieres
elegirla tú, pásala como tercer argumento.

Otros comandos útiles:

```bash
docker compose exec app npm run users:list
docker compose exec app npm run users:reset-2fa -- email@dominio.com       # si pierde el móvil
docker compose exec app npm run users:reset-password -- email@dominio.com
```

## 6. Primer inicio de sesión y 2FA

1. Entra a `http://IP-DEL-VPS` (o tu dominio) → `/login`.
2. Introduce email + contraseña → la app muestra un **QR**.
3. Escanéalo con **Google Authenticator** (o Authy/1Password) e introduce el
   código de 6 dígitos → queda activado el 2FA y entras al cockpit.
4. En accesos posteriores se pedirá email + contraseña + código.

## 7. Activar HTTPS (recomendado)

Apunta el dominio (registro A) a la IP del VPS. Luego emite el certificado con
Certbot en modo webroot:

```bash
docker run --rm \
  -v "$PWD/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot certonly --webroot -w /var/www/certbot \
  -d TU-DOMINIO.COM --email tu-email@dominio.com --agree-tos --no-eff-email
```

Edita `nginx/nginx.conf`: descomenta el bloque `server 443` y el `return 301`
del puerto 80, sustituyendo `TU-DOMINIO.COM`. Recarga Nginx:

```bash
docker compose restart nginx
```

Renovación automática (cron mensual en el host):

```bash
0 3 1 * * cd /ruta/a/nzt-studio && docker run --rm \
  -v "$PWD/nginx/certbot/conf:/etc/letsencrypt" \
  -v "$PWD/nginx/certbot/www:/var/www/certbot" \
  certbot/certbot renew && docker compose restart nginx
```

## 8. Cambiar las API keys más adelante

Edita `.env` con las nuevas claves (las de la cuenta de la empresa, no las
personales) y reinicia solo la app:

```bash
nano .env
docker compose up -d app   # recoge el nuevo .env sin reconstruir
```

## 9. Actualizar la app (nuevos cambios)

```bash
git pull
docker compose up -d --build
```

Las migraciones nuevas se aplican solas al arrancar.

## 10. Backups de la base de datos

El estado vive en el volumen `pgdata`. Backup puntual:

```bash
docker compose exec db pg_dump -U nzt nzt > backup_$(date +%F).sql
```

Restaurar:

```bash
cat backup_AAAA-MM-DD.sql | docker compose exec -T db psql -U nzt -d nzt
```

Automatízalo con un cron diario en el host.

---

### Resumen de servicios

| Servicio | Imagen            | Rol                                   |
|----------|-------------------|---------------------------------------|
| `db`     | postgres:16-alpine| Base de datos (volumen `pgdata`)      |
| `app`    | build local       | Next.js + migraciones al arrancar     |
| `nginx`  | nginx:alpine      | Reverse proxy, TLS, puertos 80/443    |
