import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { leaveCreateSchema, leaveListQuerySchema } from "@/features/leave/schema";
import { createLeave, listLeave } from "@/features/leave/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("leave:read");
    const query = leaveListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    if (query.scope !== "me" && !can(session.perms, "leave:approve")) {
      throw Forbidden("ไม่มีสิทธิ์ดูคำขอของผู้อื่น");
    }
    const records = await listLeave(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("leave:create");
    const input = leaveCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createLeave(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
