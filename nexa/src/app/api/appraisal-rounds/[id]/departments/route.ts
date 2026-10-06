import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getRoundDepartmentProgress } from "@/features/appraisal-round/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

export async function GET(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  try {
    const session = await requirePermission("campaign:manage");
    const { id } = await params;
    return ok(await getRoundDepartmentProgress(session.companyId, id));
  } catch (err) {
    return handleApiError(err);
  }
}
