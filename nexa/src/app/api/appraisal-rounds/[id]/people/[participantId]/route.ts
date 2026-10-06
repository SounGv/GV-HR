import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getParticipantResult } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

/** One person's submitted answers summarised per rater type (no names, no weighting). */
export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string; participantId: string }> }) {
  try {
    const session = await requirePermission("campaign:manage");
    const { id, participantId } = await params;
    return ok(await getParticipantResult(session.companyId, id, participantId));
  } catch (err) {
    return handleApiError(err);
  }
}
