/**
 * Employee photos are stored as data URLs (about 200 KB each). Sending them
 * inside every list and page made pages heavy, so API responses carry a short
 * address instead and the browser fetches (and caches) each photo on its own
 * from `/api/employees/{id}/avatar`.
 */

const AVATAR_PATH_RE = /^\/api\/employees\/[0-9a-fA-F-]{36}\/avatar(\?.*)?$/;

/** True for the short address that replaces a stored photo in API responses. */
export function isAvatarPath(value: unknown): value is string {
  return typeof value === "string" && AVATAR_PATH_RE.test(value);
}

/**
 * Short address for an employee photo, or the value unchanged when it is
 * already a normal link or empty.
 *
 * @param employeeId Employee the photo belongs to.
 * @param stored The `avatarUrl` column value.
 */
export function avatarSrc(employeeId: string, stored: string | null | undefined): string | null | undefined {
  if (!stored || !stored.startsWith("data:")) return stored;
  // The version changes when the photo changes, so a new photo is never served from the old cache entry.
  const version = `${stored.length.toString(36)}${stored.slice(-12).replace(/[^A-Za-z0-9]/g, "")}`;
  return `/api/employees/${employeeId}/avatar?v=${version}`;
}

/**
 * Copy of an API payload where every employee photo stored as a data URL is
 * replaced by its short address. An object counts as an employee when it has
 * both a string `id` and a data-URL `avatarUrl`; anything else is left as is.
 */
export function slimAvatars<T>(payload: T): T {
  return walk(payload) as T;
}

function walk(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(walk);
  if (value === null || typeof value !== "object" || Object.getPrototypeOf(value) !== Object.prototype) return value;

  const source = value as Record<string, unknown>;
  const result: Record<string, unknown> = {};
  for (const [key, child] of Object.entries(source)) result[key] = walk(child);
  if (typeof source.id === "string" && typeof source.avatarUrl === "string") {
    result.avatarUrl = avatarSrc(source.id, source.avatarUrl);
  }
  return result;
}
