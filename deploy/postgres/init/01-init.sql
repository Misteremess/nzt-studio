-- Inicialización del usuario de la app (se ejecuta una sola vez al crear el volumen).
-- Postgres ≥ 14: \getenv lee variables de entorno del contenedor, evitando hardcodear
-- la contraseña en el repo. NZT_DB_PASSWORD viene del docker-compose.production.yml.

\getenv nzt_password NZT_DB_PASSWORD

-- Usuario de la app con contraseña inyectada desde env.
CREATE USER nzt WITH PASSWORD :'nzt_password';

-- Permisos de base de datos.
-- CONNECT: puede conectar.
-- CREATE: necesario para que Prisma cree el schema "_prisma_migrations" en la BD.
GRANT CONNECT ON DATABASE nzt TO nzt;
GRANT CREATE ON DATABASE nzt TO nzt;

-- Permisos en el schema public (tablas de la app).
GRANT USAGE, CREATE ON SCHEMA public TO nzt;

-- DEFAULT PRIVILEGES: nuevas tablas que Prisma cree en el futuro heredan estos permisos.
-- Aplica porque el role postgres (superuser) es quien crea las tablas en el init, y
-- queremos que nzt pueda operarlas sin GRANTs manuales después.
ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE ON TABLES TO nzt;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
    GRANT USAGE, SELECT ON SEQUENCES TO nzt;
