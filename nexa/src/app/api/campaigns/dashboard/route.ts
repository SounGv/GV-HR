import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getEvaluationDashboard, type DashboardFilters } from "@/features/campaign/dashboard-service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:approve");
    const sp = req.nextUrl.searchParams;
    const filters: DashboardFilters = {
      campaignId: sp.get("campaignId") ?? undefined,
      departmentId: sp.get("departmentId") ?? undefined,
      positionId: sp.get("positionId") ?? undefined,
      managerId: sp.get("managerId") ?? undefined,
      status: (sp.get("status") as DashboardFilters["status"]) ?? undefined,
      scoreMin: sp.get("scoreMin") ? Number(sp.get("scoreMin")) : undefined,
      scoreMax: sp.get("scoreMax") ? Number(sp.get("scoreMax")) : undefined,
    };
    const data = await getEvaluationDashboard(session.companyId, session, filters);
    return ok(data);
  } catch (err) {
    return handleApiError(err);
  }
}
