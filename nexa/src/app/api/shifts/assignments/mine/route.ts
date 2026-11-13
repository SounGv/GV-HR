import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { rangeQuerySchema } from "@/features/shift/schema";
import { listMyAssignments } from "@/features/shift/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("shift:read");
    const { from, to } = rangeQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    // No employee record: no shifts of their own, an empty list rather than an error.
    if (!session.employeeId) return ok([]);
    const records = await listMyAssignments(session.companyId, session.employeeId, from, to);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}
