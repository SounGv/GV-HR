import { requirePermission } from "@/lib/auth/guard";
import { getAttendanceCorrection } from "@/features/attendance-correction/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("attendance:read");
    const { id } = await params;
    const record = await getAttendanceCorrection(session.companyId, session, id);
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
