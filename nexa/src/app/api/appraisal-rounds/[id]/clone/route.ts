import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { cloneRound } from "@/features/appraisal-round/service";
import { created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** New draft round with the same form, people, rater types and weights (no dates, nothing sent). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:create");
    const { id } = await params;
    return created(await cloneRound(session.companyId, session, id, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
