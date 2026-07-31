import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { otCreateSchema, otListQuerySchema } from "@/features/overtime/schema";
import { createOvertime, listOvertime } from "@/features/overtime/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("overtime:read");
    const query = otListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    if (query.scope !== "me" && !can(session.perms, "overtime:approve")) {
      throw Forbidden("ไม่มีสิทธิ์ดูคำขอของผู้อื่น");
    }
    const records = await listOvertime(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("overtime:create");
    const input = otCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createOvertime(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
