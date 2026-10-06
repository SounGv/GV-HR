import { requireSession } from "@/lib/auth/guard";
import { listMyResults } from "@/features/appraisal-round/results-service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** The signed-in person's own published results (empty unless the company lets people see them). */
export async function GET() {
  try {
    const session = await requireSession();
    return ok(await listMyResults(session.companyId, session));
  } catch (err) {
    return handleApiError(err);
  }
}
