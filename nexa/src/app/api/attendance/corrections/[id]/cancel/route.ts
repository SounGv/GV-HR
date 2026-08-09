import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { cancelAttendanceCorrection } from "@/features/attendance-correction/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("attendance:create");
    const { id } = await params;
    const record = await cancelAttendanceCorrection(session.companyId, session, id, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
