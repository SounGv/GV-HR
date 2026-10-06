import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { remindAll } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** "เตือนทุกคน": one reminder per rater who has not submitted, at most once an hour each. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    return ok(await remindAll(session.companyId, session, id, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
