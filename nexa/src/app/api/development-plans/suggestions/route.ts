import { requirePermission } from "@/lib/auth/guard";
import { suggestGapItems } from "@/features/development-plan/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("performance:read");
    const suggestions = await suggestGapItems(session.companyId, session);
    return ok(suggestions);
  } catch (err) {
    return handleApiError(err);
  }
}
