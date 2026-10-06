import { type NextRequest } from "next/server";
import { requireSession } from "@/lib/auth/guard";
import { acknowledgeMyResult } from "@/features/appraisal-round/results-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** "รับทราบผล": only the person the result is about, only when the company asks for it. */
export async function POST(req: NextRequest, { params }: { params: Promise<{ participantId: string }> }) {
  try {
    const session = await requireSession();
    const { participantId } = await params;
    return ok(await acknowledgeMyResult(session.companyId, session, participantId, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
