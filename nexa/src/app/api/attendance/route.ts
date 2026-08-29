import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { canAny } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { attendanceListQuerySchema } from "@/features/attendance/schema";
import { listAttendance } from "@/features/attendance/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("attendance:read");
    const query = attendanceListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );

    // Team / company-wide views require approval-level permission.
    if (query.scope !== "me" && !canAny(session.perms, ["attendance:approve", "attendance:manage"])) {
      throw Forbidden("ไม่มีสิทธิ์ดูข้อมูลของผู้อื่น");
    }

    const records = await listAttendance(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}
