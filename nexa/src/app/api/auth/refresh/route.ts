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

    const { claims, accessToken, refreshToken } = await refresh(raw, getRequestMeta(req));

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
    setSessionCookies(res, accessToken, refreshToken);
    return res;
  } catch (err) {
    // On any refresh failure, clear cookies so the client falls back to login.
    const res = handleApiError(err);
    clearSessionCookies(res);
    return res;
  }
}
