import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import {
  signRefreshToken,
  verifyRefreshToken,
  REFRESH_TTL_SECONDS,
} from "./jwt";

/**
 * Refresh-token lifecycle with rotation + revocation + reuse detection.
 *
 * We sign a JWT carrying a random `jti`, persist only the SHA-256 hash of the
 * signed token (fast deterministic lookup, never store the token itself), and
 * key the row by `jti`. On refresh we verify signature+expiry, match the hash,
 * ensure it isn't revoked/expired, then revoke it and issue a new one.
 */

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export interface IssuedRefresh {
  token: string;
  jti: string;
}

export async function issueRefreshToken(
  userId: string,
  meta?: { ip?: string; userAgent?: string },
  remember = true,
): Promise<IssuedRefresh> {
  const jti = randomUUID();
  const token = await signRefreshToken({ sub: userId, jti, remember });
  await prisma.refreshToken.create({
    data: {
      id: jti,
      userId,
      tokenHash: hashToken(token),
      expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
      createdIp: meta?.ip,
      userAgent: meta?.userAgent,
    },
  });
  return { token, jti };
}

export interface RotateResult {
  userId: string;
  token: string;
  jti: string;
  remember: boolean;
}

/** How long after a rotation the old token is still accepted once more (two requests racing on one cookie). */
export const ROTATION_GRACE_MS = 60_000;

/**
 * Longer allowance when the answer to the rotation never reached the browser (the app was put to sleep or the signal
 * dropped): the new token was issued but nobody has used it, so the old one coming back is the same person, not a thief.
 */
export const LOST_ANSWER_GRACE_MS = 5 * 60_000;

/**
 * True when this revoked token was revoked by a rotation moments ago, as opposed to a logout, a session the user
 * ended, or an old token someone kept. A rotation always issues the successor in the same moment, so a token of the
 * same user created right around the revocation is the proof; a logout leaves no such token.
 *
 * The match is on the browser (user agent), not the network address: a phone moves between wifi and mobile data
 * and between carrier gateways within seconds, so the address of two requests from one phone often differs.
 */
async function rotatedJustNow(row: { id: string; userId: string; revokedAt: Date | null }, meta?: { ip?: string; userAgent?: string }): Promise<boolean> {
  if (!row.revokedAt) return false;
  const revokedMs = row.revokedAt.getTime();
  const age = Date.now() - revokedMs;
  if (age > LOST_ANSWER_GRACE_MS) return false;
  const successors = await prisma.refreshToken.findMany({
    where: { userId: row.userId, id: { not: row.id }, userAgent: meta?.userAgent ?? null, createdAt: { gte: new Date(revokedMs - 2_000), lte: new Date(revokedMs + 5_000) } },
    select: { revokedAt: true },
  });
  if (successors.length === 0) return false;
  return age <= ROTATION_GRACE_MS || successors.some((s) => s.revokedAt === null);
}

/** Revoke the old token and store its successor in ONE step, so a failure in between cannot leave the person with neither. Null when someone else rotated it first. */
async function rotateOnce(
  row: { id: string; userId: string },
  meta: { ip?: string; userAgent?: string } | undefined,
  remember: boolean,
): Promise<RotateResult | null> {
  const jti = randomUUID();
  const token = await signRefreshToken({ sub: row.userId, jti, remember });
  const done = await prisma.$transaction(async (tx) => {
    const revoked = await tx.refreshToken.updateMany({ where: { id: row.id, revokedAt: null }, data: { revokedAt: new Date() } });
    if (revoked.count === 0) return false;
    await tx.refreshToken.create({
      data: {
        id: jti,
        userId: row.userId,
        tokenHash: hashToken(token),
        expiresAt: new Date(Date.now() + REFRESH_TTL_SECONDS * 1000),
        createdIp: meta?.ip,
        userAgent: meta?.userAgent,
      },
    });
    return true;
  });
  return done ? { userId: row.userId, token, jti, remember } : null;
}

async function signOutEverywhere(userId: string, why: string): Promise<void> {
  console.warn(`[auth] refresh token reused (${why}): all sessions of user ${userId} were revoked`);
  await revokeAllForUser(userId);
}

/**
 * Validate + rotate. Returns null when the token is invalid, unknown, expired,
 * or already revoked (reuse). On detected reuse we revoke the whole family for
 * the user as a safety measure.
 */
export async function rotateRefreshToken(
  rawToken: string,
  meta?: { ip?: string; userAgent?: string },
): Promise<RotateResult | null> {
  const claims = await verifyRefreshToken(rawToken);
  if (!claims) return null;

  const row = await prisma.refreshToken.findUnique({ where: { id: claims.jti } });
  if (!row || row.tokenHash !== hashToken(rawToken)) return null;

  if (row.revokedAt) {
    // Two requests that carry the same cookie can both reach the server within moments (a page reload while a
    // background call refreshes, two tabs, the app reopening): the second one holds a token the first just rotated.
    // That is not theft, so inside a short window it is given a fresh token instead of signing the user out everywhere.
    if (await rotatedJustNow(row, meta)) {
      const next = await issueRefreshToken(row.userId, meta, claims.remember);
      return { userId: row.userId, token: next.token, jti: next.jti, remember: claims.remember };
    }
    // Reuse of an already-rotated token → revoke everything for this user.
    await signOutEverywhere(row.userId, row.revokedAt ? `revoked ${Math.round((Date.now() - row.revokedAt.getTime()) / 1000)}s ago` : "revoked");
    return null;
  }
  if (row.expiresAt.getTime() < Date.now()) return null;

  // Revoke the old, issue a fresh one (rotation) — carrying the same
  // "remember me" choice forward, since only the original login request had
  // the checkbox. Revoke and issue happen together; if another request rotated the same token a
  // moment earlier, this one is treated like any other late arrival of that token.
  const next = await rotateOnce(row, meta, claims.remember);
  if (next) return next;
  const current = await prisma.refreshToken.findUnique({ where: { id: row.id } });
  if (current && (await rotatedJustNow(current, meta))) {
    const again = await issueRefreshToken(row.userId, meta, claims.remember);
    return { userId: row.userId, token: again.token, jti: again.jti, remember: claims.remember };
  }
  await signOutEverywhere(row.userId, "lost a rotation race");
  return null;
}

export async function revokeRefreshToken(rawToken: string): Promise<void> {
  const claims = await verifyRefreshToken(rawToken);
  if (!claims) return;
  await prisma.refreshToken.updateMany({
    where: { id: claims.jti, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export async function revokeAllForUser(userId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

export interface SessionRow {
  id: string;
  createdIp: string | null;
  userAgent: string | null;
  createdAt: Date;
  isCurrent: boolean;
}

/** Active (non-revoked, non-expired) sessions for a user, most recent first. */
export async function listSessions(userId: string, currentJti: string | null): Promise<SessionRow[]> {
  const rows = await prisma.refreshToken.findMany({
    where: { userId, revokedAt: null, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: "desc" },
    select: { id: true, createdIp: true, userAgent: true, createdAt: true },
  });
  return rows.map((r) => ({ ...r, isCurrent: r.id === currentJti }));
}

/** Revoke one session by id — scoped to `userId` so a user can only ever revoke their own row. */
export async function revokeSessionById(userId: string, id: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { id, userId, revokedAt: null },
    data: { revokedAt: new Date() },
  });
}

/** "Sign out of all other devices" — revokes every session except the caller's current one. */
export async function revokeAllExcept(userId: string, exceptId: string): Promise<void> {
  await prisma.refreshToken.updateMany({
    where: { userId, revokedAt: null, id: { not: exceptId } },
    data: { revokedAt: new Date() },
  });
}
