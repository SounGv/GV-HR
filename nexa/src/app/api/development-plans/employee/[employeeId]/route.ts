import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { BadRequest } from "@/lib/api/errors";
import { getEmployeePlan } from "@/features/development-plan/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest, { params }: { params: Promise<{ employeeId: string }> }) {
  try {
    const session = await requirePermission("performance:read");
    const { employeeId } = await params;
    const cycle = req.nextUrl.searchParams.get("cycle");
    if (!cycle) throw BadRequest("กรุณาระบุรอบ (cycle)");
    const plan = await getEmployeePlan(session.companyId, session, employeeId, cycle);
    return ok(plan);
  } catch (err) {
    return handleApiError(err);
  }
}
