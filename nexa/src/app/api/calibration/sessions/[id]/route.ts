import { requirePermission } from "@/lib/auth/guard";
import { getCalibrationSession } from "@/features/calibration/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: Request, { params }: Ctx) {
  try {
    const session = await requirePermission("calibration:read");
    const { id } = await params;
    const row = await getCalibrationSession(session.companyId, id, session);
    return ok(row);
  } catch (err) {
    return handleApiError(err);
  }
}
