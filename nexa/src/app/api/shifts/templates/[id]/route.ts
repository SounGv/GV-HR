import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { templateUpdateSchema } from "@/features/shift/schema";
import { updateTemplate, deleteTemplate } from "@/features/shift/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("shift:update");
    const { id } = await params;
    const input = templateUpdateSchema.parse(await req.json().catch(() => ({})));
    const record = await updateTemplate(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("shift:delete");
    const { id } = await params;
    const result = await deleteTemplate(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
