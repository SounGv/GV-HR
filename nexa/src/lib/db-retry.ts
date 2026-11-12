/**
 * When a database read is tried a second time.
 *
 * Production reaches Postgres through Supabase's pooler. The pooler drops
 * client connections that sat idle, and a server instance kept warm between
 * requests still holds them, so the next query on one fails with P1017
 * "Server has closed the connection" (logged with "bytes remaining on stream").
 * Prisma throws that connection away and opens a new one on the next query, so
 * running the same read again succeeds.
 *
 * Only reads are retried: a write whose connection dropped may already have
 * been applied, and running it again could save it twice.
 *
 * Kept free of Prisma so the rule can be checked on its own.
 */

/** Prisma error codes meaning the connection broke, not that the query was wrong. */
export const RETRYABLE_CODES: ReadonlySet<string> = new Set(["P1017"]);

/** Operations that only read, so running them twice changes nothing. */
export const READ_OPERATIONS: ReadonlySet<string> = new Set([
  "findUnique",
  "findUniqueOrThrow",
  "findFirst",
  "findFirstOrThrow",
  "findMany",
  "count",
  "aggregate",
  "groupBy",
]);

/**
 * Whether a failed query should be run once more.
 *
 * @param operation Prisma operation name, e.g. "findMany" or "update".
 * @param error What the query threw.
 * @returns True for a read that failed because the connection was closed.
 */
export function shouldRetryRead(operation: string, error: unknown): boolean {
  if (!READ_OPERATIONS.has(operation)) return false;
  const code =
    typeof error === "object" && error !== null ? (error as { code?: unknown }).code : undefined;
  return typeof code === "string" && RETRYABLE_CODES.has(code);
}
