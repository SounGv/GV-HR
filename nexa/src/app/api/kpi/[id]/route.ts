import { type NextRequest } from "next/server";
import { requireSession, requirePermission } from "@/lib/auth/guard";
import { can } from "@/lib/auth/rbac";
import { goalUpdateSchema, goalProgressSchema } from "@/features/kpi/schema";
import { updateGoal, updateGoalProgress, deleteGoal } from "@/features/kpi/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireSession();
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const meta = getRequestMeta(req);

    // Managers (kpi:update) may edit everything; a goal's owner may update progress only.
    if (can(session.perms, "kpi:update")) {
      const input = goalUpdateSchema.parse(body);
      const record = await updateGoal(session.companyId, session, id, input, meta);
      return ok(record);
    }

    const input = goalProgressSchema.parse(body);
    const record = await updateGoalProgress(session.companyId, session, id, input, meta);
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("kpi:delete");
    const { id } = await params;
    const result = await deleteGoal(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
