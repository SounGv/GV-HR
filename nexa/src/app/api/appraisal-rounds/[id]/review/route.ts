import { type NextRequest } from "next/server";
import { requireAnyPermission } from "@/lib/auth/guard";
import { getRoundReview } from "@/features/appraisal-round/review-service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** The review page's numbers (grade spread, manager averages, flags). Read only; for people who approve or run rounds. */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requireAnyPermission(["campaign:approve", "campaign:update"]);
    const { id } = await params;
    return ok(await getRoundReview(session.companyId, session, id));
  } catch (err) {
    return handleApiError(err);
  }
}
