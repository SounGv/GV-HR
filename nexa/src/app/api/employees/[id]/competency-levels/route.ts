import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { setEmployeeLevelsSchema } from "@/features/competency-matrix/schema";
import { getEmployeeCompetencyGap, setEmployeeCompetencyLevels } from "@/features/competency-matrix/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { id } = await params;
    const rows = await getEmployeeCompetencyGap(session.companyId, id);
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function PUT(req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:update");
    const { id } = await params;
    const body = await req.json().catch(() => ({}));
    const input = setEmployeeLevelsSchema.parse(body);
    const rows = await setEmployeeCompetencyLevels(session.companyId, session, id, input, getRequestMeta(req));
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
