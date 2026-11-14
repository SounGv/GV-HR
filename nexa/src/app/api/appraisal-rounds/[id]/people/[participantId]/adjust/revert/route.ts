import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { revertSchema } from "@/features/appraisal-round/schema";
import { revertAdjustment } from "@/features/appraisal-round/adjust-service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** HR undoes an adjustment and gets the calculated score back, with a reason. HR only (`campaign:update`). */
export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string; participantId: string }> }) {
  try {
    const session = await requirePermission("campaign:update");
    const { id, participantId } = await params;
    const body = revertSchema.parse(await req.json());
    return ok(await revertAdjustment(session.companyId, session, id, participantId, body, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
