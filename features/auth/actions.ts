"use server";

import QRCode from "qrcode";
import { prisma } from "@/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { decryptSecret, encryptSecret } from "@/lib/auth/secret-crypto";
import {
  buildOtpAuthUrl,
  generateSecret,
  verifyToken,
} from "@/lib/auth/totp";

// Resultado del primer paso del login (email + contraseña). La validación
// definitiva la hace authorize() en auth.ts; estas acciones solo deciden qué
// pantalla mostrar.
export type BeginAuthResult =
  | { status: "invalid" }
  | { status: "totp" } // cuenta ya enrolada → pedir código
  | { status: "enroll"; qrDataUrl: string; secret: string }; // primer acceso → mostrar QR

function normalizeEmail(email: string): string {
  return email.toLowerCase().trim();
}

// Paso 1: verifica credenciales y devuelve el siguiente paso del 2FA.
// Si la cuenta aún no tiene 2FA, genera un secreto provisional (cifrado, con
// totpEnabled=false) y devuelve el QR para escanear con Google Authenticator.
export async function beginAuth(
  email: string,
  password: string,
): Promise<BeginAuthResult> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  if (!user) return { status: "invalid" };

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return { status: "invalid" };

  if (user.totpEnabled && user.totpSecret) {
    return { status: "totp" };
  }

  // Enrolamiento: genera (o regenera) el secreto provisional. Como la
  // contraseña ya se validó, nadie puede disparar esto sin las credenciales.
  const secret = generateSecret();
  await prisma.user.update({
    where: { id: user.id },
    data: { totpSecret: encryptSecret(secret), totpEnabled: false },
  });

  const otpauthUri = buildOtpAuthUrl(user.email, secret);
  const qrDataUrl = await QRCode.toDataURL(otpauthUri, { margin: 1, width: 220 });

  return { status: "enroll", qrDataUrl, secret };
}

// Paso 2 (solo enrolamiento): confirma el primer código contra el secreto
// provisional y activa el 2FA. Tras esto, el cliente llama a signIn().
export async function completeEnrollment(
  email: string,
  password: string,
  code: string,
): Promise<{ ok: boolean }> {
  const user = await prisma.user.findUnique({
    where: { email: normalizeEmail(email) },
  });
  if (!user || !user.totpSecret) return { ok: false };

  const passwordOk = await verifyPassword(password, user.passwordHash);
  if (!passwordOk) return { ok: false };

  const tokenOk = verifyToken(code, decryptSecret(user.totpSecret));
  if (!tokenOk) return { ok: false };

  await prisma.user.update({
    where: { id: user.id },
    data: { totpEnabled: true },
  });

  return { ok: true };
}
