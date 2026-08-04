import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getEmployeeEvaluationHistory } from "@/features/campaign/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ employeeId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { employeeId } = await params;
    return ok(await getEmployeeEvaluationHistory(session.companyId, employeeId, session));
  } catch (err) {
    return handleApiError(err);
  }
}
