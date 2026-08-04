import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { completeSession } from "@/features/calibration/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function POST(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("calibration:approve");
    const { id } = await params;
    const result = await completeSession(session.companyId, session, id, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
