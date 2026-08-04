import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { getRefreshTokenFromRequest } from "@/lib/auth/session";
import { verifyRefreshToken } from "@/lib/auth/jwt";
import { listSessions } from "@/lib/auth/token-store";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requireSession();
    const raw = getRefreshTokenFromRequest(req);
    const claims = raw ? await verifyRefreshToken(raw) : null;
    const sessions = await listSessions(session.sub, claims?.jti ?? null);
    return ok(sessions);
  } catch (err) {
    return handleApiError(err);
  }
}
