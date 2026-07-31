import { requirePermission } from "@/lib/auth/guard";
import { getToday } from "@/features/attendance/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("attendance:read");
    const record = await getToday(session.companyId, session);
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
