import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { clockSchema } from "@/features/attendance/schema";
import { clockOut } from "@/features/attendance/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("attendance:create");
    const input = clockSchema.parse(await req.json().catch(() => ({})));
    const record = await clockOut(session.companyId, session, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}
