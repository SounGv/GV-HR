import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { evaluationRaterWeightsSchema } from "@/features/campaign/schema";
import { getEvaluationRaterWeights, updateEvaluationRaterWeights } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    return ok(await getEvaluationRaterWeights(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:update");
    const body = await req.json().catch(() => ({}));
    const input = evaluationRaterWeightsSchema.parse(body);
    const updated = await updateEvaluationRaterWeights(session.companyId, input, session, getRequestMeta(req));
    return ok(updated);
  } catch (err) {
    return handleApiError(err);
  }
}
