import { type NextRequest } from "next/server";
import { requirePermission } from "@/lib/auth/guard";
import { roleCreateSchema } from "@/features/admin/schema";
import { createRole, listRoles } from "@/features/admin/service";
import { ok, created, handleApiError } from "@/lib/api/response";
import { getRequestMeta } from "@/lib/api/request";

export const runtime = "nodejs";

export async function GET() {
  try {
    const session = await requirePermission("admin:read");
    const roles = await listRoles(session.companyId);
    return ok(roles);
  } catch (err) {
    return handleApiError(err);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await requirePermission("admin:create");
    const input = roleCreateSchema.parse(await req.json().catch(() => ({})));
    const result = await createRole(session.companyId, session, input, getRequestMeta(req));
    return created(result);
  } catch (err) {
    return handleApiError(err);
  }
}
