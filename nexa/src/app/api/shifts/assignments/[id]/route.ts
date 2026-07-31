import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { deleteAssignment } from "@/features/shift/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("shift:update");
    const { id } = await params;
    const result = await deleteAssignment(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
