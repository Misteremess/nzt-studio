import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { prisma } from "@/db/prisma";
import { verifyPassword } from "@/lib/auth/password";
import { decryptSecret } from "@/lib/auth/secret-crypto";
import { verifyToken } from "@/lib/auth/totp";
import { authConfig } from "./auth.config";

// Validación autoritativa del login. Corre en runtime Node (no Edge): tiene
// acceso a Prisma, bcrypt y crypto. El flujo UX previo (server actions en
// features/auth) solo mejora la experiencia — la verdad la decide este authorize.
//
// Reglas:
//   1. El usuario debe existir.
//   2. La contraseña debe coincidir (bcrypt).
//   3. El 2FA debe estar ya enrolado (totpEnabled). Si no, se rechaza aquí: el
//      enrolamiento se completa antes vía completeEnrollment().
//   4. El código TOTP debe ser válido.
export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      authorize: async (credentials) => {
        const { email, password, code } = credentials as {
          email?: unknown;
          password?: unknown;
          code?: unknown;
        };
        if (
          typeof email !== "string" ||
          typeof password !== "string" ||
          typeof code !== "string"
        ) {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase().trim() },
        });
        if (!user) return null;

        const passwordOk = await verifyPassword(password, user.passwordHash);
        if (!passwordOk) return null;

        // El 2FA es obligatorio: sin enrolar y confirmar, no se entra.
        if (!user.totpEnabled || !user.totpSecret) return null;

        const tokenOk = verifyToken(code, decryptSecret(user.totpSecret));
        if (!tokenOk) return null;

        return { id: user.id, email: user.email, name: user.name };
      },
    }),
  ],
});
