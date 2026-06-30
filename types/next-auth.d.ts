import type { DefaultSession } from "next-auth";

// Extiende la sesión de NextAuth para incluir el id del usuario, que
// propagamos en los callbacks jwt/session de auth.config.ts.
declare module "next-auth" {
  interface Session {
    user: {
      id: string;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
  }
}
