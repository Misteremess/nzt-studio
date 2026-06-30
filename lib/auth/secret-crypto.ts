import "server-only";
import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from "node:crypto";

// Cifrado en reposo del secreto TOTP. Aunque la BD ya está protegida, cifrar el
// secreto añade defensa en profundidad: un volcado de la tabla `users` no basta
// para clonar el 2FA de nadie sin la clave de la app.
//
// Algoritmo: AES-256-GCM (autenticado). La clave de 32 bytes se deriva de la
// env var TOTP_ENCRYPTION_KEY con scrypt. Formato almacenado: "iv:authTag:ct"
// (todo en hex).

const ALGORITHM = "aes-256-gcm";
// Salt fijo: la entropía la aporta TOTP_ENCRYPTION_KEY, y necesitamos que la
// derivación sea determinista para poder descifrar en cualquier arranque.
const KEY_SALT = "nzt-studio-totp-v1";

function getKey(): Buffer {
  const secret = process.env.TOTP_ENCRYPTION_KEY;
  if (!secret) {
    throw new Error(
      "TOTP_ENCRYPTION_KEY no está definida. Genera una con: openssl rand -base64 32",
    );
  }
  return scryptSync(secret, KEY_SALT, 32);
}

export function encryptSecret(plain: string): string {
  const iv = randomBytes(12); // 96 bits, recomendado para GCM
  const cipher = createCipheriv(ALGORITHM, getKey(), iv);
  const encrypted = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${authTag.toString("hex")}:${encrypted.toString("hex")}`;
}

export function decryptSecret(payload: string): string {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  if (!ivHex || !tagHex || !dataHex) {
    throw new Error("Secreto TOTP con formato inválido.");
  }
  const decipher = createDecipheriv(ALGORITHM, getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]).toString("utf8");
}
