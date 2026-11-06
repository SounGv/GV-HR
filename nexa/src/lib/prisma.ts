import { PrismaClient } from "@prisma/client";
import { withPoolSettings } from "./pool-settings";

/**
 * Prisma client singleton.
 *
 * In dev, Next.js hot-reload re-evaluates modules and would otherwise spawn a
 * new PrismaClient (and a new connection pool) on every reload, exhausting
 * database connections. Caching on `globalThis` prevents that. In production a
 * single instance is created per server/worker instance.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    // A few pooled connections per instance instead of one (see pool-settings.ts) — stops P2024 timeouts.
    datasourceUrl: withPoolSettings(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
