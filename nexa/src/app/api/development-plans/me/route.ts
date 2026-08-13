import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getOrCreateMyPlan } from "@/features/development-plan/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("performance:read");
    const cycle = req.nextUrl.searchParams.get("cycle") ?? undefined;
    const plan = await getOrCreateMyPlan(session.companyId, session, cycle);
    return ok(plan);
  } catch (err) {
    return handleApiError(err);
  }
}
