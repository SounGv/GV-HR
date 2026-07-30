import { NextResponse, type NextRequest } from "next/server";
import { logout } from "@/lib/auth/service";
import { clearSessionCookies, getRefreshTokenFromRequest } from "@/lib/auth/session";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  await logout(getRefreshTokenFromRequest(req));
  const res = NextResponse.json({ data: { ok: true } });
  clearSessionCookies(res);
  return res;
}
