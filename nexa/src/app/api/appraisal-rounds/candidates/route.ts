import { requirePermission } from "@/lib/auth/guard";
import { listCandidates } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** Active employees HR can pick as people to evaluate. Setting up a round is HR's job: a manager must not list the whole company here. */
export async function GET() {
  try {
    const session = await requirePermission("campaign:update");
    return ok(await listCandidates(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}
