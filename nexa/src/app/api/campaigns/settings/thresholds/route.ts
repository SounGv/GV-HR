import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { evaluationThresholdsSchema } from "@/features/campaign/schema";
import { getEvaluationThresholds, updateEvaluationThresholds } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    return ok(await getEvaluationThresholds(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:update");
    const body = await req.json().catch(() => ({}));
    const input = evaluationThresholdsSchema.parse(body);
    const updated = await updateEvaluationThresholds(session.companyId, input, session, getRequestMeta(req));
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
