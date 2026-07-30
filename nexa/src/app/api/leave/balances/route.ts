import { requirePermission } from "@/lib/auth/guard";
import { getBalances } from "@/features/leave/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("leave:read");
    const balances = await getBalances(session.companyId, session);
    return ok(balances);
  } catch (err) {
    return handleApiError(err);
  }
}
