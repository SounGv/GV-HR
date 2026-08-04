import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { getRefreshTokenFromRequest } from "@/lib/auth/session";
import { verifyRefreshToken } from "@/lib/auth/jwt";
import { revokeAllExcept } from "@/lib/auth/token-store";
import { ok, handleApiError } from "@/lib/api/response";
import { Unauthorized } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requireSession();
    const raw = getRefreshTokenFromRequest(req);
    const claims = raw ? await verifyRefreshToken(raw) : null;
    if (!claims) throw Unauthorized("ไม่พบเซสชัน");
    await revokeAllExcept(session.sub, claims.jti);
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
