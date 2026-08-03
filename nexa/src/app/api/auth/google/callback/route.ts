import { type NextRequest, NextResponse } from "next/server";
import { exchangeGoogleCode } from "@/lib/auth/google-oauth";
import { loginWithGoogle } from "@/lib/auth/service";
import { setSessionCookies } from "@/lib/auth/session";
import { OAUTH_STATE_COOKIE } from "@/lib/auth/constants";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const loginUrl = (error: string) => new URL(`/login?error=${error}`, req.url);

  const code = req.nextUrl.searchParams.get("code");
  const state = req.nextUrl.searchParams.get("state");
  const expectedState = req.cookies.get(OAUTH_STATE_COOKIE)?.value;

  if (!code || !state || !expectedState || state !== expectedState) {
    return NextResponse.redirect(loginUrl("google_invalid_state"));
  }

  try {
    const redirectUri = new URL("/api/auth/google/callback", req.url).toString();
    const profile = await exchangeGoogleCode(code, redirectUri);
    const { claims, accessToken, refreshToken } = await loginWithGoogle(profile, getRequestMeta(req));
    void claims;

    const res = NextResponse.redirect(new URL("/dashboard", req.url));
    setSessionCookies(res, accessToken, refreshToken);
    res.cookies.set(OAUTH_STATE_COOKIE, "", { path: "/", maxAge: 0 });
    return res;
  } catch (err) {
    console.error("[auth] google login failed:", err);
    return NextResponse.redirect(loginUrl("google_failed"));
  }
}
