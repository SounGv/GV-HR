import { NextResponse, type NextRequest } from "next/server";
import { refresh } from "@/lib/auth/service";
import {
  setSessionCookies,
  clearSessionCookies,
  getRefreshTokenFromRequest,
} from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/api/request";
import { handleApiError } from "@/lib/api/response";
import { AppError, Unauthorized } from "@/lib/api/errors";
import { safeRedirectPath } from "@/lib/auth/redirect";

export const runtime = "nodejs";

/**
 * Only a token that is really not valid (missing, unknown, expired, revoked, account gone) ends the session.
 * A database that timed out, a dropped connection or a bug is not the person's fault: their cookies stay, and
 * the caller is told to try again, instead of being sent to the sign-in page.
 */
function isDefiniteAuthFailure(err: unknown): boolean {
  return err instanceof AppError && err.status === 401;
}

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
    if (!isDefiniteAuthFailure(err)) {
      console.error("[auth] refresh could not be completed, session kept:", err);
      return NextResponse.json(
        { error: { code: "UNAVAILABLE", message: "ระบบไม่ว่างชั่วคราว ยังอยู่ในระบบ ลองใหม่อีกครั้ง" } },
        { status: 503, headers: { "Retry-After": "2" } },
      );
    }
    // The token itself is no good: clear the cookies so the client falls back to login.
    const res = handleApiError(err);
    clearSessionCookies(res);
    return res;
  }
}

const MAX_PAGE_RETRIES = 3;

/** A page that waits a moment and asks again, for a refresh that could not finish: the cookies are untouched, so nobody is signed out. */
function retryPage(url: URL, attempt: number) {
  const giveUp = attempt >= MAX_PAGE_RETRIES;
  const next = new URL(url);
  next.searchParams.set("try", String(attempt + 1));
  const body = giveUp
    ? `<p>ยังเชื่อมต่อไม่ได้ ข้อมูลการเข้าระบบของคุณยังอยู่ กดลองใหม่เมื่อสัญญาณดีขึ้น</p><p><a href="${next.pathname}${next.search.replace(/try=\d+/, "try=0")}">ลองใหม่</a></p>`
    : `<p>กำลังต่อเซสชัน รอสักครู่…</p>`;
  const html = `<!doctype html><html lang="th"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">${
    giveUp ? "" : `<meta http-equiv="refresh" content="2;url=${next.pathname}${next.search}">`
  }<title>GV One</title><style>body{font:16px/1.7 system-ui,sans-serif;display:grid;place-items:center;min-height:100dvh;margin:0;padding:24px;text-align:center;color:#131516}a{color:#0f766e;font-weight:600}</style></head><body><div>${body}</div></body></html>`;
  return new NextResponse(html, { status: 503, headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", "Retry-After": "2" } });
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
  } catch (err) {
    if (!isDefiniteAuthFailure(err)) {
      console.error("[auth] page refresh could not be completed, session kept:", err);
      const attempt = Number(req.nextUrl.searchParams.get("try") ?? "0") || 0;
      return retryPage(req.nextUrl, attempt);
    }
    const loginUrl = new URL("/login", req.url);
    if (redirectTo !== "/dashboard") loginUrl.searchParams.set("redirect", redirectTo);
    const res = NextResponse.redirect(loginUrl);
    clearSessionCookies(res);
    return res;
  }
}
