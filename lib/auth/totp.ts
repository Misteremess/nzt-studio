import "server-only";
import { authenticator } from "otplib";

// 2FA basado en TOTP (RFC 6238) — compatible con Google Authenticator, Authy,
// 1Password, etc. otplib usa el módulo `crypto` de Node, por lo que estas
// funciones solo deben ejecutarse en runtime Node (server actions / authorize),
// nunca en Edge.

// Etiqueta que verá el usuario en su app de autenticación.
const ISSUER = "NZT Studio";

// Acepta el código del periodo actual y el inmediatamente anterior/siguiente
// (±30s) para tolerar pequeñas desviaciones de reloj del móvil.
authenticator.options = { window: 1 };

// Genera un nuevo secreto base32 para enrolar a un usuario.
export function generateSecret(): string {
  return authenticator.generateSecret();
}

// Construye la URI otpauth:// que se codifica en el QR. Al escanearla, la app
// del usuario queda configurada para generar códigos de 6 dígitos.
export function buildOtpAuthUrl(email: string, secret: string): string {
  return authenticator.keyuri(email, ISSUER, secret);
}

// Valida un código de 6 dígitos contra el secreto del usuario.
export function verifyToken(token: string, secret: string): boolean {
  try {
    return authenticator.verify({ token: token.trim(), secret });
  } catch {
    // verify lanza si el token tiene un formato inválido — lo tratamos como fallo.
    return false;
  }
}
