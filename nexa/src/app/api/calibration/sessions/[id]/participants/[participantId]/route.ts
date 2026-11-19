import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { calibrationParticipantUpdateSchema } from "@/features/calibration/schema";
import { updateParticipantCalibration } from "@/features/calibration/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string; participantId: string }> };

export async function PATCH(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("calibration:read");
    const { id, participantId } = await params;
    const input = calibrationParticipantUpdateSchema.parse(await req.json().catch(() => ({})));
    const result = await updateParticipantCalibration(
      session.companyId,
      session,
      id,
      participantId,
      input,
      getRequestMeta(req),
    );
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
