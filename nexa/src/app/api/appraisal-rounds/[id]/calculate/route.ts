import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { calculateRound } from "@/features/appraisal-round/results-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** Works out (or refreshes) everyone's score from the answers submitted so far. Results already approved or shown are left alone. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    return ok(await calculateRound(session.companyId, session, id, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
