import { type NextRequest } from "next/server";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/guard";
import { getEvaluationDashboard, type DashboardFilters } from "@/features/campaign/dashboard-service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:approve");
    const sp = req.nextUrl.searchParams;
    // Validated here: a bad status or a non-numeric score would reach Prisma and fail as a 500.
    const query = z
      .object({
        campaignId: z.string().min(1).optional(),
        departmentId: z.string().min(1).optional(),
        positionId: z.string().min(1).optional(),
        managerId: z.string().min(1).optional(),
        status: z.enum(["GOOD", "NEEDS_IMPROVEMENT", "WATCH", "URGENT"]).optional(),
        scoreMin: z.coerce.number().finite().optional(),
        scoreMax: z.coerce.number().finite().optional(),
      })
      .parse({
        campaignId: sp.get("campaignId") || undefined,
        departmentId: sp.get("departmentId") || undefined,
        positionId: sp.get("positionId") || undefined,
        managerId: sp.get("managerId") || undefined,
        status: sp.get("status") || undefined,
        scoreMin: sp.get("scoreMin") || undefined,
        scoreMax: sp.get("scoreMax") || undefined,
      });
    const filters: DashboardFilters = query;
    const data = await getEvaluationDashboard(session.companyId, session, filters);
    return ok(data);
  } catch (err) {
    return handleApiError(err);
  }
}
