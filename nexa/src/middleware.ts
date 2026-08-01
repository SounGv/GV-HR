import { NextResponse, type NextRequest } from "next/server";
import { verifyAccessToken } from "@/lib/auth/jwt";
import { ACCESS_COOKIE, REFRESH_COOKIE } from "@/lib/auth/constants";

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
  "/api/auth/refresh",
  "/api/auth/logout",
  "/api/health", // TEMP diagnostic — remove after fixing DB connectivity
]);

function isPublicApi(pathname: string) {
  return PUBLIC_API.has(pathname);
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  const accessToken = req.cookies.get(ACCESS_COOKIE)?.value;
  const hasRefresh = !!req.cookies.get(REFRESH_COOKIE)?.value;
  const claims = accessToken ? await verifyAccessToken(accessToken) : null;
  const isApi = pathname.startsWith("/api");

  // Already authenticated users shouldn't see the login page.
  if (pathname === "/login" && claims) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }
  // The login page itself is public — let it through, otherwise unauthenticated
  // visits redirect to /login → /login → … (infinite loop).
  if (pathname === "/login") {
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
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|woff2?)$).*)",
  ],
};
