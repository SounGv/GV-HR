import { PrismaClient } from "@prisma/client";
import { withPoolSettings } from "./pool-settings";
import { shouldRetryRead } from "./db-retry";

/** Builds the client: pool settings for the pooler, and one retry for a read on a dropped connection. */
function createPrisma() {
  return new PrismaClient({
    // A few pooled connections per instance instead of one (see pool-settings.ts) — stops P2024 timeouts.
    datasourceUrl: withPoolSettings(process.env.DATABASE_URL),
    log: process.env.NODE_ENV === "development" ? ["error", "warn"] : ["error"],
  }).$extends({
    query: {
      // The pooler closes idle connections; the read is run again on a fresh one (see db-retry.ts).
      async $allOperations({ operation, args, query }) {
        try {
          return await query(args);
        } catch (err) {
          if (!shouldRetryRead(operation, err)) throw err;
          return query(args);
        }
      },
    },
  });
}

/**
 * Prisma client singleton.
 *
 * In dev, Next.js hot-reload re-evaluates modules and would otherwise spawn a
 * new PrismaClient (and a new connection pool) on every reload, exhausting
 * database connections. Caching on `globalThis` prevents that. In production a
 * single instance is created per server/worker instance.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: ReturnType<typeof createPrisma> | undefined;
};

export const prisma = globalForPrisma.prisma ?? createPrisma();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
