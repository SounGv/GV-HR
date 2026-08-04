import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { planUpdateSchema } from "@/features/succession/schema";
import { deletePlan, getPlan, updatePlan } from "@/features/succession/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("succession:read");
    const { id } = await params;
    const plan = await getPlan(session.companyId, id);
    return ok(plan);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("succession:update");
    const { id } = await params;
    const input = planUpdateSchema.parse(await req.json().catch(() => ({})));
    const result = await updatePlan(session.companyId, session, id, input, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("succession:delete");
    const { id } = await params;
    await deletePlan(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
