import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { publishSchema } from "@/features/appraisal-round/schema";
import { approveResults } from "@/features/appraisal-round/results-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** Approves calculated results (only when the company requires approval). Needs the approval permission. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:approve");
    const { id } = await params;
    const { participantIds } = publishSchema.parse(await req.json().catch(() => ({})));
    return ok(await approveResults(session.companyId, session, id, participantIds, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
