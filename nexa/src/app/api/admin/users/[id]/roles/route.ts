import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { setUserRolesSchema } from "@/features/admin/schema";
import { setUserRoles } from "@/features/admin/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PUT(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin:update");
    const { id } = await params;
    const { roleIds } = setUserRolesSchema.parse(await req.json().catch(() => ({})));
    await setUserRoles(session.companyId, session, id, roleIds, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
