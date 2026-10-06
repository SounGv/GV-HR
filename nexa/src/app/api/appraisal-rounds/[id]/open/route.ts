import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { openRound } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** Opens the round and, if its start day has come, sends the invitations (in-app inbox + LINE). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    return ok(await openRound(session.companyId, session, id, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
