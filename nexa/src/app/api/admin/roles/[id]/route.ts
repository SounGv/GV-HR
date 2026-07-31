import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { roleUpdateSchema } from "@/features/admin/schema";
import { deleteRole, updateRole } from "@/features/admin/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("admin:update");
    const { id } = await params;
    const input = roleUpdateSchema.parse(await req.json().catch(() => ({})));
    const result = await updateRole(session.companyId, session, id, input, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("admin:delete");
    const { id } = await params;
    await deleteRole(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
