import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { planCreateSchema } from "@/features/succession/schema";
import { createPlan, listPlans } from "@/features/succession/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("succession:read");
    const rows = await listPlans(session.companyId);
    return ok(rows);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("succession:create");
    const input = planCreateSchema.parse(await req.json().catch(() => ({})));
    const result = await createPlan(session.companyId, session, input, getRequestMeta(req));
    return created(result);
  } catch (err) {
    return handleApiError(err);
  }
}
