import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { rejectResultSchema } from "@/features/campaign/schema";
import { rejectParticipantResult } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ participantId: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:approve");
    const { participantId } = await params;
    const body = await req.json().catch(() => ({}));
    const input = rejectResultSchema.parse(body);
    const result = await rejectParticipantResult(session.companyId, session, participantId, input.note, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
