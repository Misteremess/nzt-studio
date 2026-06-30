// Carga variables de entorno para scripts ejecutados con tsx fuera de Next.
// Debe importarse ANTES que cualquier módulo que lea process.env (p. ej.
// db/prisma). En producción (Docker) las vars vienen del contenedor: dotenv
// no sobrescribe las que ya existen, así que es seguro llamarlo siempre.
import { config } from "dotenv";

config({ path: ".env.local" });
config(); // .env como fallback; no pisa valores ya presentes
