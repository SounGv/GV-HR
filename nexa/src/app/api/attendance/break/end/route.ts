import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { endBreak } from "@/features/attendance/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("attendance:create");
    const record = await endBreak(session.companyId, session, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
