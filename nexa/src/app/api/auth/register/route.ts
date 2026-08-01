import { type NextRequest } from "next/server";
import { registerSchema } from "@/features/auth/schema";
import { registerCompany } from "@/lib/auth/register";
import { login } from "@/lib/auth/service";
import { setSessionCookies } from "@/lib/auth/session";
import { getRequestMeta } from "@/lib/api/request";
import { created, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const input = registerSchema.parse(body);
    const meta = getRequestMeta(req);

    await registerCompany(input);

    // Auto-login the new owner so they land straight in the dashboard.
    const { claims, accessToken, refreshToken } = await login(input.email, input.password, meta);

    const res = created({
      user: {
        id: claims.sub,
        email: claims.email,
        companyId: claims.companyId,
        roles: claims.roles,
        permissions: claims.perms,
        employeeId: claims.employeeId ?? null,
      },
    });
    setSessionCookies(res, accessToken, refreshToken);
    return res;
  } catch (err) {
    return handleApiError(err);
  }
}
