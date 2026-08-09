import { type NextRequest } from "next/server";
import { changePasswordSchema } from "@/features/auth/schema";
import { changePassword } from "@/lib/auth/service";
import { requireSession } from "@/lib/auth/guard";
import { getRefreshTokenFromRequest } from "@/lib/auth/session";
import { verifyRefreshToken } from "@/lib/auth/jwt";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const body = await req.json().catch(() => ({}));
    const { currentPassword, newPassword } = changePasswordSchema.parse(body);

    const raw = getRefreshTokenFromRequest(req);
    const claims = raw ? await verifyRefreshToken(raw) : null;

    await changePassword(session.sub, currentPassword, newPassword, claims?.jti ?? null);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
