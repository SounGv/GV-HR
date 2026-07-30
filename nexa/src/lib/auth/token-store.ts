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
): Promise<IssuedRefresh> {
  const jti = randomUUID();
  const token = await signRefreshToken({ sub: userId, jti });
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
    // Reuse of an already-rotated token → revoke everything for this user.
    await revokeAllForUser(row.userId);
    return null;
  }
  if (row.expiresAt.getTime() < Date.now()) return null;

  // Revoke the old, issue a fresh one (rotation).
  await prisma.refreshToken.update({
    where: { id: row.id },
    data: { revokedAt: new Date() },
  });
  const next = await issueRefreshToken(row.userId, meta);
  return { userId: row.userId, token: next.token, jti: next.jti };
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
