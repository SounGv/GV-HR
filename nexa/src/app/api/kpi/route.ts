import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { canAny } from "@/lib/auth/rbac";
import { Forbidden } from "@/lib/api/errors";
import { goalCreateSchema, goalListQuerySchema } from "@/features/kpi/schema";
import { createGoal, listGoals } from "@/features/kpi/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("kpi:read");
    const query = goalListQuerySchema.parse(
      Object.fromEntries(req.nextUrl.searchParams.entries()),
    );
    if (query.scope !== "me" && !canAny(session.perms, ["kpi:create", "kpi:update"])) {
      throw Forbidden("ไม่มีสิทธิ์ดูเป้าหมายของผู้อื่น");
    }
    const records = await listGoals(session.companyId, session, query);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("kpi:create");
    const input = goalCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createGoal(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
