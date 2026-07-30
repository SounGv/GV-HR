import { NextResponse, type NextRequest } from "next/server";
import { loginSchema } from "@/features/auth/schema";
import { login } from "@/lib/auth/service";
import { setSessionCookies } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/api/request";
import { handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const { email, password } = loginSchema.parse(body);

    const { claims, accessToken, refreshToken } = await login(
      email,
      password,
      getRequestMeta(req),
    );

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
    return handleApiError(err);
  }
}
