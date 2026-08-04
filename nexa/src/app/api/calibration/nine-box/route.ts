import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { nineBoxQuerySchema } from "@/features/calibration/schema";
import { getNineBoxGrid } from "@/features/calibration/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("calibration:read");
    const query = nineBoxQuerySchema.parse(Object.fromEntries(req.nextUrl.searchParams.entries()));
    const grid = await getNineBoxGrid(session.companyId, session, query);
    return ok(grid);
  } catch (err) {
    return handleApiError(err);
  }
}
