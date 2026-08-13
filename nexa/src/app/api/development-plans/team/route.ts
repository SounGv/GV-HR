import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { listTeamPlans } from "@/features/development-plan/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("performance:read");
    const cycle = req.nextUrl.searchParams.get("cycle") ?? undefined;
    const plans = await listTeamPlans(session.companyId, session, cycle);
    return ok(plans);
  } catch (err) {
    return handleApiError(err);
  }
}
