import { requirePermission } from "@/lib/auth/guard";
import { listPublishedForms } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** Published forms a round can use. */
export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    return ok(await listPublishedForms(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}
