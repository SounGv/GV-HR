import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { adjustSchema } from "@/features/appraisal-round/schema";
import { adjustScore } from "@/features/appraisal-round/adjust-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** HR changes a calculated score by up to 5 points, with a reason. HR only (`campaign:update`). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; participantId: string }> }) {
  try {
    const session = await requirePermission("campaign:update");
    const { id, participantId } = await params;
    const body = adjustSchema.parse(await req.json());
    return ok(await adjustScore(session.companyId, session, id, participantId, body, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
