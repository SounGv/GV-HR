import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { getCompetencyUsage } from "@/features/competency/service";
import { ok, handleApiError } from "@/lib/api/response";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { id } = await params;
    return ok(await getCompetencyUsage(session.companyId, id));
  } catch (err) {
    return handleApiError(err);
  }
}
