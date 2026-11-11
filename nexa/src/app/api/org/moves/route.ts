import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { orgMovesSchema } from "@/features/organization/schema";
import { applyOrgMoves } from "@/features/organization/service";
import { ok, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

/** Org chart edit mode: set each listed employee's department and direct manager in one transaction. */
export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("employee:update");
    const input = orgMovesSchema.parse(await req.json().catch(() => ({})));
    const result = await applyOrgMoves(session.companyId, session, input, getRequestMeta(req));
    return ok(result);
  } catch (err) {
    return handleApiError(err);
  }
}
