import "server-only";
import bcrypt from "bcryptjs";

// Hashing de contraseñas con bcryptjs (puro JS — sin binarios nativos, compila
// limpio en la imagen Docker). El cost factor 12 es un equilibrio razonable
// entre seguridad y latencia de login para un cockpit interno.
const BCRYPT_ROUNDS = 12;

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}
