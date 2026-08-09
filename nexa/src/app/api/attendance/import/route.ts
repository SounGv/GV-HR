import type { NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRequestMeta } from "@/lib/api/request";
import { ok, handleApiError } from "@/lib/api/response";
import { attendanceImportPayloadSchema } from "@/features/attendance-import/schema";
import { importAttendance } from "@/features/attendance-import/service";

export const runtime = "nodejs";

export async function POST(request: NextRequest) {
  try {
    const session = await requirePermission("attendance:update");
    const { rows } = attendanceImportPayloadSchema.parse(await request.json().catch(() => ({})));
    const summary = await importAttendance(
      session.companyId,
      session,
      rows as Record<string, unknown>[],
      getRequestMeta(request),
    );
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
