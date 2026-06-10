import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

// `pg` warns that sslmode=require/prefer/verify-ca (currently aliased to the
// stricter verify-full) will adopt weaker libpq semantics in pg v9. We already
// rely on verify-full behavior, so pin it explicitly to silence the warning
// and keep the same security guarantees.
function withExplicitSslMode(url: string): string {
  return url.replace(/sslmode=(require|prefer|verify-ca)\b/, "sslmode=verify-full");
}

function createPrismaClient() {
  const adapter = new PrismaPg({
    connectionString: withExplicitSslMode(process.env.DATABASE_URL!),
  });
  return new PrismaClient({ adapter });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
