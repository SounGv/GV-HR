import { type NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/auth/guard";
import { attendanceCorrectionDecideSchema } from "@/features/attendance-correction/schema";
import { decideAttendanceCorrection } from "@/features/attendance-correction/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAnyPermission(["attendance:approve", "attendance:manage"]);
    const { id } = await params;
    const input = attendanceCorrectionDecideSchema.parse(await req.json().catch(() => ({})));
    const record = await decideAttendanceCorrection(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
