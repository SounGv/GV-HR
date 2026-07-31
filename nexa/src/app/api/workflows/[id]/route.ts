import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { workflowUpdateSchema } from "@/features/workflow/schema";
import { updateWorkflow, deleteWorkflow } from "@/features/workflow/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("workflow:update");
    const { id } = await params;
    const input = workflowUpdateSchema.parse(await req.json().catch(() => ({})));
    const record = await updateWorkflow(session.companyId, session, id, input, getRequestMeta(req));
    return ok(record);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function DELETE(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("workflow:delete");
    const { id } = await params;
    const result = await deleteWorkflow(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
