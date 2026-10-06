import { requireSession } from "@/lib/auth/guard";
import { listMyAssignments } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** The signed-in person's own evaluation jobs (who they have to rate). */
export async function GET() {
  try {
    const session = await requireSession();
    return ok(await listMyAssignments(session.companyId, session));
  } catch (err) {
    return handleApiError(err);
  }
}
