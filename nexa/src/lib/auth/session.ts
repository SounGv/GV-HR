import { cookies } from "next/headers";
import type { NextRequest, NextResponse } from "next/server";
import {
  verifyAccessToken,
  ACCESS_TTL_SECONDS,
  REFRESH_TTL_SECONDS,
  type AccessClaims,
} from "./jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "./constants";

export { ACCESS_COOKIE, REFRESH_COOKIE };

const isProd = process.env.NODE_ENV === "production";

const baseCookie = {
  httpOnly: true,
  secure: isProd,
  sameSite: "lax" as const,
  path: "/",
};

/** Session as seen by the app: the verified access-token claims. */
export type SessionUser = AccessClaims;

/** Write both auth cookies onto a NextResponse (used by login / refresh). */
export function setSessionCookies(res: NextResponse, accessToken: string, refreshToken: string) {
  res.cookies.set(ACCESS_COOKIE, accessToken, {
    ...baseCookie,
    maxAge: ACCESS_TTL_SECONDS,
  });
  res.cookies.set(REFRESH_COOKIE, refreshToken, {
    ...baseCookie,
    maxAge: REFRESH_TTL_SECONDS,
    // Refresh token is only ever sent to the refresh endpoint.
    path: "/api/auth",
  });
}

export function clearSessionCookies(res: NextResponse) {
  res.cookies.set(ACCESS_COOKIE, "", { ...baseCookie, maxAge: 0 });
  res.cookies.set(REFRESH_COOKIE, "", { ...baseCookie, path: "/api/auth", maxAge: 0 });
}

/** Read + verify the current session from the request cookies (Server Components / route handlers). */
export async function getSession(): Promise<SessionUser | null> {
  const store = await cookies();
  const token = store.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

/** Same, but from a NextRequest (middleware / route handlers that receive req). */
export async function getSessionFromRequest(req: NextRequest): Promise<SessionUser | null> {
  const token = req.cookies.get(ACCESS_COOKIE)?.value;
  if (!token) return null;
  return verifyAccessToken(token);
}

export function getRefreshTokenFromRequest(req: NextRequest): string | null {
  return req.cookies.get(REFRESH_COOKIE)?.value ?? null;
}
