import { SignJWT, jwtVerify } from "jose";

/**
 * Stateless JWT access tokens + opaque-ish refresh tokens (jose HS256).
 *
 * Access token: short-lived (default 15 min), carries the session claims used
 * for RBAC so most requests need no DB hit. Refresh token: long-lived, used
 * only against /api/auth/refresh; its hash is stored in the DB (RefreshToken)
 * so it can be rotated and revoked.
 */

export interface AccessClaims {
  sub: string; // userId
  companyId: string;
  email: string | null;
  username: string | null;
  roles: string[];
  perms: string[];
  employeeId?: string;
}

export interface RefreshClaims {
  sub: string; // userId
  jti: string; // token id (matches RefreshToken row)
}

function requireSecret(name: string): Uint8Array {
  const value = process.env[name];
  if (!value || value.startsWith("change-me")) {
    // Fail loudly instead of silently signing with a guessable key.
    if (process.env.NODE_ENV === "production") {
      throw new Error(`Missing required secret env var: ${name}`);
    }
  }
  return new TextEncoder().encode(value ?? `dev-${name}`);
}

const accessSecret = () => requireSecret("JWT_ACCESS_SECRET");
const refreshSecret = () => requireSecret("JWT_REFRESH_SECRET");

const ACCESS_TTL = Number(process.env.ACCESS_TOKEN_TTL ?? 900); // 15 min
const REFRESH_TTL = Number(process.env.REFRESH_TOKEN_TTL ?? 1209600); // 14 days

export const REFRESH_TTL_SECONDS = REFRESH_TTL;
export const ACCESS_TTL_SECONDS = ACCESS_TTL;

export async function signAccessToken(claims: AccessClaims): Promise<string> {
  return new SignJWT({ ...claims })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(claims.sub)
    .setExpirationTime(`${ACCESS_TTL}s`)
    .sign(accessSecret());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    return payload as unknown as AccessClaims;
  } catch {
    return null;
  }
}

export async function signRefreshToken(claims: RefreshClaims): Promise<string> {
  return new SignJWT({ jti: claims.jti })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(claims.sub)
    .setExpirationTime(`${REFRESH_TTL}s`)
    .sign(refreshSecret());
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims | null> {
  try {
    const { payload } = await jwtVerify(token, refreshSecret());
    return { sub: payload.sub as string, jti: payload.jti as string };
  } catch {
    return null;
  }
}

const MFA_TTL_SECONDS = 300; // 5 min — just long enough to read a code off an authenticator app

/**
 * Short-lived token proving "password already verified, awaiting 2FA code."
 * Signed with the access secret but carries a distinct `purpose` claim so it
 * can never be mistaken for (or reused as) a real access token.
 */
export async function signMfaToken(userId: string): Promise<string> {
  return new SignJWT({ purpose: "mfa" })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setSubject(userId)
    .setExpirationTime(`${MFA_TTL_SECONDS}s`)
    .sign(accessSecret());
}

export async function verifyMfaToken(token: string): Promise<{ sub: string } | null> {
  try {
    const { payload } = await jwtVerify(token, accessSecret());
    if (payload.purpose !== "mfa" || typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}
