import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { setPositionRequirementsSchema } from "@/features/competency-matrix/schema";
import { getPositionRequirements, setPositionRequirements } from "@/features/competency-matrix/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

type Ctx = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Ctx) {
  try {
    const session = await requirePermission("campaign:read");
    const { id } = await params;
    const rows = await getPositionRequirements(session.companyId, id);
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
    const input = setPositionRequirementsSchema.parse(body);
    const rows = await setPositionRequirements(session.companyId, session, id, input, getRequestMeta(req));
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}
