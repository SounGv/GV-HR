import { type NextRequest } from "next/server";
import { z } from "zod";
import { requireAnyPermission } from "@/lib/auth/guard";
import { handleApiError, ok } from "@/lib/api/response";
import { getDayAttendance } from "@/features/calendar/day-service";

export const runtime = "nodejs";

const querySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "รูปแบบวันที่ไม่ถูกต้อง (YYYY-MM-DD)"),
});

/**
 * Absent / on leave / late on one day. Same permission and team scope as the attendance overview on the dashboard,
 * so the calendar shows nobody the dashboard would hide.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requireAnyPermission(["attendance:approve", "attendance:manage"]);
    const { date } = querySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    return ok(await getDayAttendance(session.companyId, session, date));
  } catch (err) {
    return handleApiError(err);
  }
}
