import { randomBytes } from "node:crypto";
import { type NextRequest, NextResponse } from "next/server";
import { buildGoogleAuthUrl, isGoogleOAuthEnabled } from "@/lib/auth/google-oauth";
import { OAUTH_STATE_COOKIE } from "@/lib/auth/constants";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  if (!isGoogleOAuthEnabled()) {
    return NextResponse.redirect(new URL("/login?error=google_disabled", req.url));
  }

  const state = randomBytes(24).toString("hex");
  const redirectUri = new URL("/api/auth/google/callback", req.url).toString();

  const res = NextResponse.redirect(buildGoogleAuthUrl(state, redirectUri));
  res.cookies.set(OAUTH_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 300, // 5 minutes — only needs to survive the round trip to Google
  });
  return res;
}
