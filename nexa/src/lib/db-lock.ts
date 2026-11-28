import { prisma } from "@/lib/prisma";

/** The client to use inside {@link withAdvisoryLock}: the same queries as `prisma`, on the connection that holds the lock. */
export type LockedDb = Omit<typeof prisma, "$connect" | "$disconnect" | "$on" | "$transaction" | "$use" | "$extends">;

/**
 * Runs `work` while holding a database lock named `key`, so two requests with the same key run one after the other
 * instead of at the same time. Without it, "check that nothing clashes, then insert" lets two quick requests (a double
 * tap, a retry) both pass the check and both insert.
 *
 * The lock is released when `work` returns or throws. Everything `work` reads or writes must go through the `tx` it is
 * given, never the global `prisma`: the pool has one connection per server instance, and the lock's transaction is
 * holding it, so a query on `prisma` would wait for a connection that is never freed.
 *
 * @param key What is being protected, for example `leave:<employee id>`. Same key = one at a time.
 * @param work The check and the write, using `tx`.
 */
export async function withAdvisoryLock<T>(key: string, work: (tx: LockedDb) => Promise<T>): Promise<T> {
  return prisma.$transaction(
    async (tx) => {
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${key}))`;
      return work(tx);
    },
    { maxWait: 10_000, timeout: 20_000 },
  );
}
