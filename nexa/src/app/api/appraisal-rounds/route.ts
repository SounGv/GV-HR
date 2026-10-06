import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { roundCreateSchema } from "@/features/appraisal-round/schema";
import { createRound, listRounds } from "@/features/appraisal-round/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("campaign:manage");
    return ok(await listRounds(session.companyId));
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("campaign:create");
    const { name } = roundCreateSchema.parse(await req.json().catch(() => ({})));
    return created(await createRound(session.companyId, session, name, getRequestMeta(req)));
  } catch (err) {
    return handleApiError(err);
  }
}
