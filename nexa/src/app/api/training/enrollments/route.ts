import { requirePermission } from "@/lib/auth/guard";
import { listMyEnrollments } from "@/features/training/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("training:read");
    const records = await listMyEnrollments(session.companyId, session);
    return ok(records);
  } catch (err) {
    return handleApiError(err);
  }
}
