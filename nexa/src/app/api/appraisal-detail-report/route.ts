import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getDetailOverview, getDetailPerson } from "@/features/appraisal-round/detail-report-service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/**
 * The detailed evaluation report. `?roundId=` gives the overview (people, teams, history); adding `&participantId=` gives
 * one person's sheet-by-sheet detail with the names of the raters. HR only (`campaign:update`); read only.
 */
export async function GET(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:update");
    const q = req.nextUrl.searchParams;
    const roundId = q.get("roundId");
    const participantId = q.get("participantId");
    if (roundId && participantId) return ok(await getDetailPerson(session.companyId, roundId, participantId));
    return ok(await getDetailOverview(session.companyId, roundId));
  } catch (err) {
    return handleApiError(err);
  }
}
