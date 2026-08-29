import { timingSafeEqual } from "crypto";

/**
 * Constant-time string comparison for static bearer-token auth (Vercel Cron,
 * gv-ops-bot's roster feed, etc.) — a plain `===` leaks a timing signal an
 * attacker can use to guess the secret one byte at a time. `timingSafeEqual`
 * itself throws on mismatched lengths, so that's checked first (also not
 * timing-safe, but the length of a fixed server-side secret isn't sensitive
 * the way its content is).
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}
