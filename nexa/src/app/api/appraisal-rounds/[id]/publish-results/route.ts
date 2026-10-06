import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { publishSchema } from "@/features/appraisal-round/schema";
import { publishResults } from "@/features/appraisal-round/results-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** Publishes results of a closed round; tells each person if the company lets people see their results. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    const { participantIds } = publishSchema.parse(await req.json().catch(() => ({})));
    return ok(await publishResults(session.companyId, session, id, participantIds, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
