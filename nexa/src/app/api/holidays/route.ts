import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { holidayCreateSchema, holidayListQuerySchema } from "@/features/holiday/schema";
import { listHolidays, createHoliday } from "@/features/holiday/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("holiday:read");
    const { year } = holidayListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    const holidays = await listHolidays(session.companyId, year);
    return ok(holidays);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("holiday:create");
    const body = await req.json().catch(() => ({}));
    const input = holidayCreateSchema.parse(body);
    const holiday = await createHoliday(session.companyId, input, session, getRequestMeta(req));
    return created(holiday);
  } catch (err) {
    return handleApiError(err);
  }
}
