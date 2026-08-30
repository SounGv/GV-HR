import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE, CSRF_COOKIE, CSRF_HEADER } from "@/lib/auth/constants";

const MUTATING_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/**
 * Edge auth guard.
 *
 *  • Valid access token           → allow (and bounce away from /login).
 *  • Expired access + refresh set  → allow the page through; the client will
 *                                    silently refresh via /api/auth/refresh.
 *                                    For API calls, return 401 so the client's
 *                                    fetch layer can refresh-and-retry.
 *  • No tokens at all              → redirect pages to /login; 401 for API.
 *
 * NOTE: this is the real Next middleware (must be named `middleware.ts`) — the
 * previous prototype shipped an inert `proxy.ts` that never executed.
 */

const PUBLIC_API = new Set([
  "/api/auth/login",
  "/api/auth/register",
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/auth/forgot-password",
  "/api/auth/reset-password",
  "/api/auth/google",
  "/api/auth/google/callback",
  // 2FA verify runs after password check but before a session exists — the
  // caller proves intent with the short-lived mfaToken instead of a cookie.
  "/api/auth/mfa/verify",
  "/api/ai/status",
  // Cron-triggered routes have no session cookie (Vercel Cron calls them
  // directly) — they authenticate themselves via a CRON_SECRET bearer token
  // instead, checked inside the route handler.
  "/api/cron/evaluation-schedules",
  // LINE's servers call this directly (no session cookie) — authenticates
  // itself via the x-line-signature HMAC header, checked inside the handler.
  "/api/integrations/line/webhook",
  // gv-ops-bot (a separate service) calls this directly (no session cookie) —
  // authenticates itself via a GV_OPS_BOT_API_KEY bearer token, checked
  // inside the handler.
  "/api/integrations/line/roster",
]);

const PUBLIC_PAGES = new Set(["/login", "/register", "/offline", "/forgot-password", "/reset-password"]);

function isPublicApi(pathname: string) {
  return PUBLIC_API.has(pathname);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefresh = !!req.cookies.get(REFRESH_COOKIE)?.value;
  const claims = accessToken ? await verifyAccessToken(accessToken) : null;
  const isApi = pathname.startsWith("/api");

  // Public payslip verification pages (QR target) — no auth required.
  if (pathname.startsWith("/verify/")) {
    return NextResponse.next();
  }

  // Already authenticated users shouldn't see the login/register pages.
  if (PUBLIC_PAGES.has(pathname) && claims) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  // Login/register are public — let them through, otherwise unauthenticated
  // visits redirect to /login → /login → … (infinite loop).
  if (PUBLIC_PAGES.has(pathname)) {
    return NextResponse.next();
  }

  if (isApi) {
    if (isPublicApi(pathname)) return NextResponse.next();
    if (!claims) {
      return NextResponse.json(
        { error: { code: "UNAUTHORIZED", message: "ไม่ได้เข้าสู่ระบบ" } },
        { status: 401 },
      );
    }
    // Double-submit CSRF check: a mutating request using the session cookie
    // must echo the (non-httpOnly) CSRF cookie back as a header — a
    // cross-site page can trigger the cookie-bearing request but can't read
    // the cookie value to put in the header.
    if (MUTATING_METHODS.has(req.method)) {
      const csrfCookie = req.cookies.get(CSRF_COOKIE)?.value;
      const csrfHeader = req.headers.get(CSRF_HEADER);
      if (!csrfCookie || !csrfHeader || csrfCookie !== csrfHeader) {
        return NextResponse.json(
          { error: { code: "CSRF_INVALID", message: "คำขอไม่ผ่านการตรวจสอบความปลอดภัย กรุณาโหลดหน้าใหม่แล้วลองอีกครั้ง" } },
          { status: 403 },
        );
      }
    }
    return NextResponse.next();
  }

  // Page requests
  if (claims || hasRefresh) return NextResponse.next();

  const loginUrl = new URL("/login", req.url);
  if (pathname !== "/") loginUrl.searchParams.set("redirect", pathname);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  // Run on everything except Next internals, static files, and the auth API
  // (which must stay reachable to log in / refresh).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|sw.js|manifest.webmanifest|robots.txt|sitemap.xml|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
