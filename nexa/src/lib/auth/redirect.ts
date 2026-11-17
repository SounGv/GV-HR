/**
 * The page to go to after sign-in or a session refresh, taken from a `redirect` query value.
 * Only a path inside this site is allowed: it must start with one slash, and not with two ("//host" is a
 * link to another site) or contain a backslash (browsers read "/\host" as "//host"). Anything else is
 * replaced by the fallback. Pure, so the sign-in form and the refresh route share it.
 */
export function safeRedirectPath(raw: string | null | undefined, fallback = "/dashboard"): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//") || raw.includes("\\") || /[\u0000-\u001f]/.test(raw)) return fallback;
  return raw;
}
