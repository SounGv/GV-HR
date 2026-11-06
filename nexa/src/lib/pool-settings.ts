/**
 * Connection settings for the runtime database URL.
 *
 * Production runs on Vercel through Supabase's transaction pooler (port 6543).
 * The URL used to carry `connection_limit=1`, so every server instance had one
 * connection: a page that loads several sections at once (the dashboard has
 * eight or more) queued them all on it, and anything still waiting after
 * Prisma's default 10 seconds failed with P2024 "Timed out fetching a new
 * connection from the connection pool". The pooler multiplexes client
 * connections, so a few per instance is safe on the free plan.
 *
 * Kept free of Prisma so the rule can be checked on its own.
 */

/** Connections each server instance may open to the pooler. */
export const POOL_CONNECTIONS = 5;
/** Seconds a query may wait for a free connection before failing. */
export const POOL_TIMEOUT_SECONDS = 20;

/**
 * The URL with at least {@link POOL_CONNECTIONS} connections and a
 * {@link POOL_TIMEOUT_SECONDS} wait, for the transaction pooler only.
 *
 * @param url DATABASE_URL as configured.
 * @returns The same URL with the two settings raised; any other URL (a direct
 *   connection, a local database, an unreadable value) comes back unchanged.
 *   A higher value already in the URL is kept.
 */
export function withPoolSettings(url: string | undefined): string | undefined {
  if (!url) return url;
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return url;
  }
  if (parsed.port !== "6543") return url;
  const limit = Number(parsed.searchParams.get("connection_limit") ?? 0);
  if (!(limit >= POOL_CONNECTIONS)) parsed.searchParams.set("connection_limit", String(POOL_CONNECTIONS));
  const timeout = Number(parsed.searchParams.get("pool_timeout") ?? 0);
  if (!(timeout >= POOL_TIMEOUT_SECONDS)) parsed.searchParams.set("pool_timeout", String(POOL_TIMEOUT_SECONDS));
  return parsed.toString();
}
