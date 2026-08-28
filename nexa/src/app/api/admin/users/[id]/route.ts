import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { deleteUser } from "@/features/admin/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("admin:delete");
    const { id } = await params;
    await deleteUser(session.companyId, session, id, getRequestMeta(req));
    return ok({ ok: true });
  } catch (err) {
    return handleApiError(err);
  }
}
