import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { authConfig } from "./auth.config";

export const { handlers, auth, signIn, signOut } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      async authorize(credentials) {
        const adminEmail = process.env.PRIVATE_ADMIN_EMAIL;
        const adminPassword = process.env.PRIVATE_ADMIN_PASSWORD;

        if (!adminEmail || !adminPassword) return null;

        const { email, password } = credentials as {
          email: string;
          password: string;
        };

        if (email === adminEmail && password === adminPassword) {
          return { id: "admin", email: adminEmail, name: "Admin" };
        }

        return null;
      },
    }),
  ],
});
