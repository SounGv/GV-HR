/**
 * The public address of this app, for links inside LINE messages and emails.
 *
 * `APP_URL` wins when it is set. Otherwise on Vercel the production domain that
 * Vercel provides is used, so a missing `APP_URL` never sends people a link to
 * `http://localhost:3000`, which opens nothing for them.
 */
export function appBaseUrl(): string {
  const explicit = process.env.APP_URL?.trim();
  if (explicit) return explicit.replace(/\/+$/, "");
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL?.trim();
  if (production) return `https://${production.replace(/^https?:\/\//, "").replace(/\/+$/, "")}`;
  return "http://localhost:3000";
}
