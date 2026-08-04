import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { calibrationSessionCreateSchema } from "@/features/calibration/schema";
import { createSession, listSessions } from "@/features/calibration/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("calibration:read");
    const rows = await listSessions(session.companyId);
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("calibration:create");
    const input = calibrationSessionCreateSchema.parse(await req.json().catch(() => ({})));
    const result = await createSession(session.companyId, session, input, getRequestMeta(req));
    return created(result);
  } catch (err) {
    return handleApiError(err);
  }
}
