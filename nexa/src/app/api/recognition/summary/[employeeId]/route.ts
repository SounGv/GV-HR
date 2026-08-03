import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRecognitionSummary } from "@/features/recognition/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ employeeId: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("recognition:read");
    const { employeeId } = await params;
    const summary = await getRecognitionSummary(session.companyId, session, employeeId);
    return ok(summary);
  } catch (err) {
    return handleApiError(err);
  }
}
