import { config } from "dotenv";

// Load .env.local so Prisma CLI commands pick up the same DATABASE_URL
// that Next.js uses at runtime — no need to maintain a separate .env file.
config({ path: ".env.local" });

import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  // Used by Prisma CLI (migrate dev, db push, studio).
  // The runtime client uses the adapter in db/prisma.ts instead.
  datasource: {
    url: process.env.DATABASE_URL,
  },
});
