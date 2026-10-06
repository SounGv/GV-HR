import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { createProbationRound } from "@/features/appraisal-round/service";
import { created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** New draft round for the people whose probation ends within 30 days. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    return created(await createProbationRound(session.companyId, session, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
