import type { NextAuthConfig } from "next-auth";

// Edge-compatible config — used by middleware.ts.
// Does NOT include CredentialsProvider (requires Node.js).
// The authorized callback handles routing logic for all requests.
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === "/login";

      if (isOnLogin) {
        if (isLoggedIn) {
          return Response.redirect(new URL("/home", nextUrl));
        }
        return true;
      }

      return isLoggedIn;
    },
    // Propaga el id del usuario (y rol) al token JWT y a la sesión, para poder
    // distinguir quién está conectado (tú vs. tu compañero) en server actions.
    jwt({ token, user }) {
      if (user) {
        token.id = user.id;
      }
      return token;
    },
    session({ session, token }) {
      if (token.id && session.user) {
        session.user.id = token.id as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
