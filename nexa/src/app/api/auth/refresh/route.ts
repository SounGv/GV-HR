import { NextResponse, type NextRequest } from "next/server";
import { refresh } from "@/lib/auth/service";
import {
  setSessionCookies,
  clearSessionCookies,
  getRefreshTokenFromRequest,
} from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/api/request";
import { handleApiError } from "@/lib/api/response";
import { Unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const raw = getRefreshTokenFromRequest(req);
    if (!raw) throw Unauthorized("ไม่พบเซสชัน");

    const { claims, accessToken, refreshToken, remember } = await refresh(raw, getRequestMeta(req));

    const res = NextResponse.json({
      data: {
        user: {
          id: claims.sub,
          email: claims.email,
          companyId: claims.companyId,
          roles: claims.roles,
          permissions: claims.perms,
          employeeId: claims.employeeId ?? null,
        },
      },
    });
    setSessionCookies(res, accessToken, refreshToken, remember);
    return res;
  } catch (err) {
    // On any refresh failure, clear cookies so the client falls back to login.
    const res = handleApiError(err);
    clearSessionCookies(res);
    return res;
  }
}

/** Only an app-relative path — never follow a redirect target off this origin. */
function safeRedirectPath(raw: string | null): string {
  if (!raw || !raw.startsWith("/") || raw.startsWith("//")) return "/dashboard";
  return raw;
}

/**
 * Full-page-navigation counterpart to POST: a page whose access-token cookie
 * expired while its refresh cookie is still good (e.g. the app reopened after
 * sitting closed for >15 min) gets redirected here by middleware instead of
 * rendering straight through to a server component that only ever checks the
 * access token and would otherwise bounce it to /login despite "remember me."
 */
export async function GET(req: NextRequest) {
  const redirectTo = safeRedirectPath(req.nextUrl.searchParams.get("redirect"));
  try {
    const raw = getRefreshTokenFromRequest(req);
    if (!raw) throw Unauthorized("ไม่พบเซสชัน");

    const { accessToken, refreshToken, remember } = await refresh(raw, getRequestMeta(req));
    const res = NextResponse.redirect(new URL(redirectTo, req.url));
    setSessionCookies(res, accessToken, refreshToken, remember);
    return res;
  } catch {
    const loginUrl = new URL("/login", req.url);
    if (redirectTo !== "/dashboard") loginUrl.searchParams.set("redirect", redirectTo);
    const res = NextResponse.redirect(loginUrl);
    clearSessionCookies(res);
    return res;
  }
}
