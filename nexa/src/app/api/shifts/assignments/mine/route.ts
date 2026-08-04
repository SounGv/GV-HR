import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { rangeQuerySchema } from "@/features/shift/schema";
import { listMyAssignments } from "@/features/shift/service";
import { ok, handleApiError } from "@/lib/api/response";
import { BadRequest } from "@/lib/api/errors";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("shift:read");
    if (!session.employeeId) {
      throw BadRequest("บัญชีนี้ไม่ได้ผูกกับข้อมูลพนักงาน");
    }
    const { from, to } = rangeQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const records = await listMyAssignments(session.companyId, session.employeeId, from, to);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}
