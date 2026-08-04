import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { finalizeParticipant } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ participantId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:approve");
    const { participantId } = await params;
    const result = await finalizeParticipant(session.companyId, session, participantId, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
