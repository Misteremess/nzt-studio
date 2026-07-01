#!/bin/bash
# Inicialización del usuario de la app (se ejecuta una sola vez al crear el volumen).
# NZT_DB_PASSWORD viene del environment del contenedor (docker-compose.production.yml).
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
    CREATE USER nzt WITH PASSWORD '${NZT_DB_PASSWORD}';
    GRANT CONNECT ON DATABASE nzt TO nzt;
    GRANT CREATE ON DATABASE nzt TO nzt;
    GRANT USAGE, CREATE ON SCHEMA public TO nzt;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO nzt;
    ALTER DEFAULT PRIVILEGES IN SCHEMA public
        GRANT USAGE, SELECT ON SEQUENCES TO nzt;
EOSQL
