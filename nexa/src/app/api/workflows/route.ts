import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { workflowCreateSchema } from "@/features/workflow/schema";
import { listWorkflows, createWorkflow } from "@/features/workflow/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("workflow:read");
    const activeOnly = req.nextUrl.searchParams.get("active") === "1";
    const records = await listWorkflows(session.companyId, activeOnly);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("workflow:create");
    const input = workflowCreateSchema.parse(await req.json().catch(() => ({})));
    const record = await createWorkflow(session.companyId, session, input, getRequestMeta(req));
    return created(record);
  } catch (err) {
    return handleApiError(err);
  }
}
