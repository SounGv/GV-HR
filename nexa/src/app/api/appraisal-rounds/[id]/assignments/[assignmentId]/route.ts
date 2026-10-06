import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { answersSchema } from "@/features/appraisal-round/schema";
import { getAssignmentForHr, saveAssignmentAsHr } from "@/features/appraisal-round/results-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; assignmentId: string }> };

/** HR opens a rater's job to fill it in for them. */
export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:update");
    const { id, assignmentId } = await params;
    return ok(await getAssignmentForHr(session.companyId, id, assignmentId));
  } catch (err) {
    return handleApiError(err);
  }
}

/** HR saves or submits on the rater's behalf; the audit log records who did it. */
export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:update");
    const { id, assignmentId } = await params;
    const input = answersSchema.parse(await req.json().catch(() => ({})));
    return ok(await saveAssignmentAsHr(session.companyId, session, id, assignmentId, input, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
