import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { canAny } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import {
  attendanceCorrectionCreateSchema,
  attendanceCorrectionListQuerySchema,
} from "@/features/attendance-correction/schema";
import {
  createAttendanceCorrection,
  listAttendanceCorrections,
} from "@/features/attendance-correction/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("attendance:read");
    const query = attendanceCorrectionListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    if (query.scope !== "me" && !canAny(session.perms, ["attendance:approve", "attendance:manage"])) {
      throw Forbidden("ไม่มีสิทธิ์ดูคำขอของผู้อื่น");
    }
    const records = await listAttendanceCorrections(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("attendance:create");
    const input = attendanceCorrectionCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createAttendanceCorrection(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
